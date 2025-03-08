// src/utils/mediaProcessing.js
// Media processing utilities for image and video compression

import { Platform } from 'react-native';
import { Image } from 'react-native-image-crop-picker';
import { ProcessingManager } from 'react-native-video-processing';
import RNFS from 'react-native-fs';
import { v4 as uuidv4 } from 'uuid';
import ImageResizer from 'react-native-image-resizer';
import { FFmpegKit } from 'ffmpeg-kit-react-native';

// Constants for media processing
const IMAGE_QUALITY = 80; // 0-100
const THUMBNAIL_SIZE = 300;
const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 1920;
const MAX_IMAGE_SIZE_MB = 5;
const MAX_VIDEO_SIZE_MB = 20;
const MAX_VIDEO_DURATION = 60; // seconds
const VIDEO_BITRATE = 2000000; // 2 Mbps
const MB_IN_BYTES = 1024 * 1024;

/**
 * Process and optimize an image for upload
 * 
 * @param {Object} imageData - Image data from picker
 * @returns {Promise<Object>} Processed image info
 */
export const processImage = async (imageData) => {
  try {
    if (!imageData || !imageData.uri) {
      throw new Error('Invalid image data');
    }

    // Check if image needs resizing
    let needsResizing = false;
    let needsCompression = false;
    
    // Check dimensions
    if (imageData.width > MAX_IMAGE_WIDTH || imageData.height > MAX_IMAGE_HEIGHT) {
      needsResizing = true;
    }
    
    // Check file size
    if (imageData.fileSize > MAX_IMAGE_SIZE_MB * MB_IN_BYTES) {
      needsCompression = true;
    }
    
    // If no processing needed, return original
    if (!needsResizing && !needsCompression) {
      return {
        uri: imageData.uri,
        width: imageData.width,
        height: imageData.height,
        fileSize: imageData.fileSize,
        mime: imageData.mime || 'image/jpeg',
      };
    }
    
    // Get optimal dimensions while maintaining aspect ratio
    const aspectRatio = imageData.width / imageData.height;
    let targetWidth = imageData.width;
    let targetHeight = imageData.height;
    
    if (needsResizing) {
      if (aspectRatio >= 1) { // Landscape or square
        targetWidth = Math.min(imageData.width, MAX_IMAGE_WIDTH);
        targetHeight = Math.round(targetWidth / aspectRatio);
      } else { // Portrait
        targetHeight = Math.min(imageData.height, MAX_IMAGE_HEIGHT);
        targetWidth = Math.round(targetHeight * aspectRatio);
      }
    }
    
    // Determine quality based on file size
    let quality = IMAGE_QUALITY;
    if (needsCompression && imageData.fileSize > 2 * MAX_IMAGE_SIZE_MB * MB_IN_BYTES) {
      quality = 60; // More aggressive compression for very large images
    } else if (needsCompression) {
      quality = 70; // Standard compression for large images
    }
    
    // Get file extension from mime type
    const mimeToExt = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
    };
    
    const extension = mimeToExt[imageData.mime] || 'jpg';
    const outputFormat = extension === 'png' ? 'PNG' : 'JPEG';
    
    // Process the image
    const processedImage = await ImageResizer.createResizedImage(
      imageData.uri,
      targetWidth,
      targetHeight,
      outputFormat,
      quality,
      0, // No rotation
      null, // Use temp directory
      false, // Don't use exact size
      { mode: 'contain', onlyScaleDown: true }
    );
    
    // Get file size of processed image
    const fileInfo = await RNFS.stat(processedImage.uri);
    
    return {
      uri: processedImage.uri,
      width: processedImage.width,
      height: processedImage.height,
      fileSize: fileInfo.size,
      mime: `image/${extension.toLowerCase()}`,
    };
  } catch (error) {
    console.error('Error processing image:', error);
    // Return original image if processing fails
    return imageData;
  }
};

/**
 * Create thumbnail from an image
 * 
 * @param {string} imageUri - Image URI
 * @returns {Promise<string>} Thumbnail URI
 */
export const createImageThumbnail = async (imageUri) => {
  try {
    const extension = imageUri.split('.').pop().toLowerCase();
    const outputFormat = extension === 'png' ? 'PNG' : 'JPEG';
    
    const thumbnail = await ImageResizer.createResizedImage(
      imageUri,
      THUMBNAIL_SIZE,
      THUMBNAIL_SIZE,
      outputFormat,
      80,
      0,
      null,
      false,
      { mode: 'cover' }
    );
    
    return thumbnail.uri;
  } catch (error) {
    console.error('Error creating image thumbnail:', error);
    return imageUri;
  }
};

/**
 * Process and optimize a video for upload
 * 
 * @param {Object} videoData - Video data from picker
 * @returns {Promise<Object>} Processed video info
 */
export const processVideo = async (videoData) => {
  try {
    if (!videoData || !videoData.uri) {
      throw new Error('Invalid video data');
    }
    
    // Check if video needs processing
    let needsProcessing = false;
    
    // Check file size
    if (videoData.fileSize > MAX_VIDEO_SIZE_MB * MB_IN_BYTES) {
      needsProcessing = true;
    }
    
    // Check duration
    if (videoData.duration > MAX_VIDEO_DURATION) {
      needsProcessing = true;
    }
    
    // If no processing needed, return original
    if (!needsProcessing) {
      return {
        uri: videoData.uri,
        duration: videoData.duration,
        fileSize: videoData.fileSize,
        mime: videoData.mime || 'video/mp4',
      };
    }
    
    // Create temporary file path
    const tempFilePath = `${RNFS.CachesDirectoryPath}/processed_video_${uuidv4()}.mp4`;
    
    // Trim video if needed
    let videoUri = videoData.uri;
    if (videoData.duration > MAX_VIDEO_DURATION) {
      if (Platform.OS === 'ios') {
        const options = {
          startTime: 0,
          endTime: MAX_VIDEO_DURATION,
          quality: 'medium',
          outputURL: `file://${tempFilePath}`,
        };
        
        const { source } = await ProcessingManager.trim(videoData.uri, options);
        videoUri = source;
      } else {
        // For Android, use FFmpeg
        const command = `-i "${videoData.uri}" -ss 0 -t ${MAX_VIDEO_DURATION} -c:v libx264 -c:a aac "${tempFilePath}"`;
        await FFmpegKit.execute(command);
        videoUri = `file://${tempFilePath}`;
      }
    }
    
    // Compress video
    const compressOptions = {
      width: 1280,
      height: 720,
      bitrateMultiplier: 3,
      minimumBitrate: VIDEO_BITRATE / 2,
      removeAudio: false,
    };
    
    const compressedVideo = await ProcessingManager.compress(videoUri, compressOptions);
    
    // Create thumbnail
    const thumbnailUri = await createVideoThumbnail(compressedVideo.source);
    
    // Get file size of processed video
    const fileInfo = await RNFS.stat(compressedVideo.source);
    
    return {
      uri: compressedVideo.source,
      thumbnailUri,
      duration: Math.min(videoData.duration, MAX_VIDEO_DURATION),
      fileSize: fileInfo.size,
      mime: 'video/mp4',
    };
  } catch (error) {
    console.error('Error processing video:', error);
    // Return original video if processing fails
    return videoData;
  }
};

/**
 * Create thumbnail from a video
 * 
 * @param {string} videoUri - Video URI
 * @returns {Promise<string>} Thumbnail URI
 */
export const createVideoThumbnail = async (videoUri) => {
  try {
    const options = {
      sourceUrl: videoUri,
      thumbnailPath: `${RNFS.CachesDirectoryPath}/thumbnail_${uuidv4()}.jpg`,
      timeStamp: 1000, // Get thumbnail from 1 second into the video
      quality: 200, // Thumbnail quality
    };
    
    const { path } = await ProcessingManager.getPreviewForSecond(options);
    return path;
  } catch (error) {
    console.error('Error creating video thumbnail:', error);
    return null;
  }
};

/**
 * Calculate optimal compression settings based on file size
 * 
 * @param {number} fileSize - File size in bytes
 * @param {number} targetSizeMB - Target size in MB
 * @returns {Object} Compression settings
 */
export const calculateCompressionSettings = (fileSize, targetSizeMB = MAX_IMAGE_SIZE_MB) => {
  const targetSize = targetSizeMB * MB_IN_BYTES;
  const ratio = targetSize / fileSize;
  
  // If file is already smaller than target, no need for aggressive compression
  if (ratio >= 1) {
    return {
      quality: 90,
      resizeRatio: 1,
    };
  }
  
  // Calculate quality based on how much we need to reduce
  let quality = Math.round(Math.min(90, Math.max(60, ratio * 100)));
  
  // Calculate resize ratio - only resize if file is significantly larger
  let resizeRatio = 1;
  if (ratio < 0.5) {
    resizeRatio = Math.sqrt(ratio); // Use square root for more balanced reduction
    resizeRatio = Math.max(0.5, resizeRatio); // Don't go below 50%
  }
  
  return {
    quality,
    resizeRatio,
  };
};

/**
 * Get image dimensions from URI
 * 
 * @param {string} uri - Image URI
 * @returns {Promise<Object>} Image dimensions
 */
export const getImageDimensions = (uri) => {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => {
        resolve({ width, height });
      },
      (error) => {
        reject(error);
      }
    );
  });
};

// Export a unified media picker and processor for easier integration
export const pickAndProcessMedia = async (options) => {
  try {
    const {
      mediaType = 'photo',
      multiple = false,
      maxFiles = 1,
      includeBase64 = false,
      cropping = false,
      ...restOptions
    } = options;
    
    // Open picker based on media type
    let result;
    
    if (mediaType === 'photo') {
      if (multiple) {
        result = await Image.openPicker({
          mediaType: 'photo',
          multiple: true,
          maxFiles,
          compressImageMaxWidth: MAX_IMAGE_WIDTH,
          compressImageMaxHeight: MAX_IMAGE_HEIGHT,
          compressImageQuality: IMAGE_QUALITY / 100,
          includeBase64,
          cropping,
          ...restOptions,
        });
      } else {
        result = await Image.openPicker({
          mediaType: 'photo',
          compressImageMaxWidth: MAX_IMAGE_WIDTH,
          compressImageMaxHeight: MAX_IMAGE_HEIGHT,
          compressImageQuality: IMAGE_QUALITY / 100,
          includeBase64,
          cropping,
          ...restOptions,
        });
      }
      
      // Process each image
      if (multiple) {
        const processed = await Promise.all(result.map(img => processImage(img)));
        return processed;
      } else {
        const processed = await processImage(result);
        return processed;
      }
    } else if (mediaType === 'video') {
      result = await Image.openPicker({
        mediaType: 'video',
        compressVideoPreset: 'MediumQuality',
        ...restOptions,
      });
      
      const processed = await processVideo(result);
      return processed;
    } else if (mediaType === 'mixed') {
      result = await Image.openPicker({
        mediaType: 'any',
        multiple: true,
        maxFiles,
        ...restOptions,
      });
      
      // Process each item based on its type
      const processed = await Promise.all(
        result.map(item =>
          item.mime.startsWith('image/')
            ? processImage(item)
            : processVideo(item)
        )
      );
      
      return processed;
    }
    
    return result;
  } catch (error) {
    console.error('Error picking and processing media:', error);
    throw error;
  }
};
// src/utils/mediaProcessing.js
// Media processing utilities for image and video compression

import { Platform } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import { ProcessingManager } from 'react-native-video-processing';
import RNFS from 'react-native-fs';
import { v4 as uuidv4 } from 'uuid';
import ImageResizer from 'react-native-image-resizer';
import { FFmpegKit } from 'ffmpeg-kit-react-native';
import { Image } from 'react-native';
import { createThumbnail } from 'react-native-create-thumbnail';

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
    if (!imageData) {
      throw new Error('Invalid image data');
    }

    // Make sure we have a valid URI
    const imagePath = imageData.uri || imageData.path;
    if (!imagePath) {
      throw new Error('No valid image path found');
    }

    // Ensure we have the required properties
    const imageWidth = imageData.width || 0;
    const imageHeight = imageData.height || 0;
    const imageSize = imageData.size || 0;
    const imageMime = imageData.mime || 'image/jpeg';

    // Check if image needs resizing
    let needsResizing = false;
    let needsCompression = false;
    
    // Check dimensions
    if (imageWidth > MAX_IMAGE_WIDTH || imageHeight > MAX_IMAGE_HEIGHT) {
      needsResizing = true;
    }
    
    // Check file size
    if (imageSize > MAX_IMAGE_SIZE_MB * MB_IN_BYTES) {
      needsCompression = true;
    }
    
    // If no processing needed, return original
    if (!needsResizing && !needsCompression) {
      return {
        uri: imagePath,
        width: imageWidth,
        height: imageHeight,
        fileSize: imageSize,
        mime: imageMime,
      };
    }
    
    // Get optimal dimensions while maintaining aspect ratio
    const aspectRatio = imageWidth / imageHeight;
    let targetWidth = imageWidth;
    let targetHeight = imageHeight;
    
    if (needsResizing) {
      if (aspectRatio >= 1) { // Landscape or square
        targetWidth = Math.min(imageWidth, MAX_IMAGE_WIDTH);
        targetHeight = Math.round(targetWidth / aspectRatio);
      } else { // Portrait
        targetHeight = Math.min(imageHeight, MAX_IMAGE_HEIGHT);
        targetWidth = Math.round(targetHeight * aspectRatio);
      }
    }
    
    // Determine quality based on file size
    let quality = IMAGE_QUALITY;
    if (needsCompression && imageSize > 2 * MAX_IMAGE_SIZE_MB * MB_IN_BYTES) {
      quality = 60; // More aggressive compression for very large images
    } else if (needsCompression) {
      quality = 70; // Standard compression for large images
    }
    
    // Get file extension from mime type
    const mimeToExt = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/heic': 'jpg', // Convert HEIC to JPEG
      'image/heif': 'jpg', // Convert HEIF to JPEG
    };
    
    const extension = mimeToExt[imageMime] || 'jpg';
    const outputFormat = extension === 'png' ? 'PNG' : 'JPEG';
    
    // Process the image
    const processedImage = await ImageResizer.createResizedImage(
      imagePath,
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
    if (imageData && (imageData.uri || imageData.path)) {
      return {
        uri: imageData.uri || imageData.path,
        width: imageData.width || 0,
        height: imageData.height || 0,
        fileSize: imageData.size || 0,
        mime: imageData.mime || 'image/jpeg',
      };
    }
    // If we don't have valid image data, rethrow
    throw error;
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
    if (!imageUri) {
      throw new Error('Invalid image URI');
    }
    
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
    if (!videoData) {
      throw new Error('Invalid video data');
    }
    
    // Make sure we have a valid URI
    const videoUri = videoData.uri || videoData.path;
    if (!videoUri) {
      throw new Error('No valid video path found');
    }
    
    // Extract duration and size from videoData, with defaults if missing
    const duration = videoData.duration || 0; // Duration in seconds
    const fileSize = videoData.size || 0; // Size in bytes
    const videoMime = videoData.mime || 'video/mp4';
    
    // Check if video needs processing
    let needsProcessing = false;
    
    // Check file size
    if (fileSize > MAX_VIDEO_SIZE_MB * MB_IN_BYTES) {
      needsProcessing = true;
    }
    
    // Check duration
    if (duration > MAX_VIDEO_DURATION) {
      needsProcessing = true;
    }
    
    // If no processing needed, return original
    if (!needsProcessing) {
      return {
        uri: videoUri,
        duration: duration,
        fileSize: fileSize,
        mime: videoMime,
      };
    }
    
    // Create temporary file path
    const tempFilePath = `${RNFS.CachesDirectoryPath}/processed_video_${uuidv4()}.mp4`;
    
    // Trim video if needed
    let processedVideoUri = videoUri;
    if (duration > MAX_VIDEO_DURATION) {
      if (Platform.OS === 'ios') {
        try {
          const options = {
            startTime: 0,
            endTime: MAX_VIDEO_DURATION,
            quality: 'medium',
            saveToCameraRoll: false,
            saveWithCurrentDate: false,
          };
          
          const result = await ProcessingManager.trim(videoUri, options);
          processedVideoUri = result.source;
        } catch (trimError) {
          console.error('Error trimming video on iOS:', trimError);
          // Fall back to FFmpeg
          const command = `-i "${videoUri}" -ss 0 -t ${MAX_VIDEO_DURATION} -c:v libx264 -c:a aac "${tempFilePath}"`;
          await FFmpegKit.execute(command);
          processedVideoUri = `file://${tempFilePath}`;
        }
      } else {
        // For Android, use FFmpeg
        const command = `-i "${videoUri}" -ss 0 -t ${MAX_VIDEO_DURATION} -c:v libx264 -c:a aac "${tempFilePath}"`;
        await FFmpegKit.execute(command);
        processedVideoUri = `file://${tempFilePath}`;
      }
    }
    
    // Compress video if needed
    let compressedVideoUri = processedVideoUri;
    if (fileSize > MAX_VIDEO_SIZE_MB * MB_IN_BYTES) {
      try {
        // Create another temp file for compression
        const compressedFilePath = `${RNFS.CachesDirectoryPath}/compressed_video_${uuidv4()}.mp4`;
        
        if (Platform.OS === 'ios') {
          const compressOptions = {
            width: 1280,
            height: 720,
            bitrateMultiplier: 3,
            minimumBitrate: VIDEO_BITRATE / 2,
            removeAudio: false,
            saveToCameraRoll: false,
            saveWithCurrentDate: false,
          };
          
          const result = await ProcessingManager.compress(processedVideoUri, compressOptions);
          compressedVideoUri = result.source;
        } else {
          // Use FFmpeg for more reliable compression on Android
          const command = `-i "${processedVideoUri}" -vf "scale=1280:720:force_original_aspect_ratio=decrease" -c:v libx264 -crf 28 -preset medium -c:a aac -b:a 128k "${compressedFilePath}"`;
          await FFmpegKit.execute(command);
          compressedVideoUri = `file://${compressedFilePath}`;
        }
      } catch (compressError) {
        console.error('Error compressing video:', compressError);
        // Continue with the trimmed but uncompressed video
      }
    }
    
    // Create thumbnail
    let thumbnailUri = null;
    try {
      thumbnailUri = await createVideoThumbnail(compressedVideoUri);
    } catch (thumbnailError) {
      console.error('Error creating video thumbnail:', thumbnailError);
      // Continue without thumbnail
    }
    
    // Get file size of processed video
    let finalFileSize = fileSize;
    try {
      const fileInfo = await RNFS.stat(compressedVideoUri.replace('file://', ''));
      finalFileSize = fileInfo.size;
    } catch (fileError) {
      console.error('Error getting file size:', fileError);
    }
    
    return {
      uri: compressedVideoUri,
      thumbnailUri,
      duration: Math.min(duration, MAX_VIDEO_DURATION),
      fileSize: finalFileSize,
      mime: 'video/mp4',
    };
  } catch (error) {
    console.error('Error processing video:', error);
    // Return original video if processing fails
    if (videoData && (videoData.uri || videoData.path)) {
      return {
        uri: videoData.uri || videoData.path,
        duration: videoData.duration || 0,
        fileSize: videoData.size || 0,
        mime: videoData.mime || 'video/mp4',
      };
    }
    // If we don't have valid video data, rethrow
    throw error;
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
    if (!videoUri) {
      throw new Error('Invalid video URI');
    }
    
    // First try using react-native-create-thumbnail
    try {
      const result = await createThumbnail({
        url: videoUri,
        timeStamp: 1000, // Get thumbnail from 1 second into the video
        quality: 0.8,
      });
      
      return result.path;
    } catch (thumbnailError) {
      console.error('Error with createThumbnail, trying FFmpeg:', thumbnailError);
      
      // Fall back to FFmpeg if available
      const outputPath = `${RNFS.CachesDirectoryPath}/thumbnail_${uuidv4()}.jpg`;
      
      // Use FFmpeg to create thumbnail
      const command = `-i "${videoUri}" -ss 1 -vframes 1 -f image2 "${outputPath}"`;
      await FFmpegKit.execute(command);
      
      return `file://${outputPath}`;
    }
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
  if (!fileSize || fileSize <= 0) {
    return {
      quality: 90,
      resizeRatio: 1,
    };
  }

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
    if (!uri) {
      reject(new Error('Image URI is required'));
      return;
    }

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

/**
 * Unified media picker and processor for easier integration
 * 
 * @param {Object} options - Picker options
 * @returns {Promise<Object|Array>} Processed media
 */
export const pickAndProcessMedia = async (options) => {
  try {
    const {
      mediaType = 'photo',
      multiple = false,
      maxFiles = 1,
      includeBase64 = false,
      cropping = false,
      ...restOptions
    } = options || {};
    
    // Open picker based on media type
    let result;
    
    if (mediaType === 'photo') {
      if (multiple) {
        result = await ImagePicker.openPicker({
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
        result = await ImagePicker.openPicker({
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
      if (multiple && Array.isArray(result)) {
        const processed = await Promise.all(result.map(img => processImage(img)));
        return processed;
      } else if (result) {
        const processed = await processImage(result);
        return processed;
      }
      return null;
    } else if (mediaType === 'video') {
      result = await ImagePicker.openPicker({
        mediaType: 'video',
        compressVideoPreset: 'MediumQuality',
        ...restOptions,
      });
      
      if (!result) return null;
      
      const processed = await processVideo(result);
      return processed;
    } else if (mediaType === 'mixed') {
      result = await ImagePicker.openPicker({
        mediaType: 'any',
        multiple: true,
        maxFiles,
        ...restOptions,
      });
      
      // Process each item based on its type
      if (Array.isArray(result)) {
        const processed = await Promise.all(
          result.map(item => {
            if (!item || !item.mime) return null;
            return item.mime.startsWith('image/')
              ? processImage(item)
              : processVideo(item);
          })
        );
        
        return processed.filter(item => item !== null);
      } else if (result && result.mime) {
        // Handle single item selection
        return result.mime.startsWith('image/') 
          ? processImage(result) 
          : processVideo(result);
      }
    }
    
    return result || null;
  } catch (error) {
    console.error('Error picking and processing media:', error);
    throw error;
  }
};
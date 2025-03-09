// src/utils/mediaProcessing.js
// Utilities for processing images and videos before upload

import { Platform } from 'react-native';
import ImageResizer from 'react-native-image-resizer';
import { Image } from 'react-native-compressor';
import { Video } from 'react-native-compressor';
import RNFS from 'react-native-fs';
import { FFmpegKit } from 'ffmpeg-kit-react-native';
import { createThumbnail } from 'react-native-create-thumbnail';

// Maximum dimensions for uploaded images
const MAX_IMAGE_DIMENSION = 1200;
const MAX_IMAGE_SIZE_MB = 5;
const MAX_THUMBNAIL_DIMENSION = 500;
const IMAGE_QUALITY = 80;

// Video constants
const MAX_VIDEO_DIMENSION = 720;
const MAX_VIDEO_SIZE_MB = 50;
const MAX_VIDEO_DURATION_SEC = 120;
const VIDEO_BITRATE = '2M';

/**
 * Process an image before upload (resize and compress)
 * @param {Object} image - Image object from image picker
 * @returns {Promise<Object>} Processed image
 */
export const processImage = async (image) => {
  if (!image || !image.uri) {
    throw new Error('Invalid image object');
  }
  
  try {
    // Check if image needs resizing
    const needsResize = (image.width > MAX_IMAGE_DIMENSION || image.height > MAX_IMAGE_DIMENSION);
    let processedUri = image.uri;
    
    // Resize if needed
    if (needsResize) {
      // Calculate new dimensions while maintaining aspect ratio
      let newWidth, newHeight;
      if (image.width > image.height) {
        newWidth = MAX_IMAGE_DIMENSION;
        newHeight = Math.floor(image.height * (MAX_IMAGE_DIMENSION / image.width));
      } else {
        newHeight = MAX_IMAGE_DIMENSION;
        newWidth = Math.floor(image.width * (MAX_IMAGE_DIMENSION / image.height));
      }
      
      // Resize the image
      const resizeResult = await ImageResizer.createResizedImage(
        image.uri,
        newWidth,
        newHeight,
        'JPEG',
        IMAGE_QUALITY,
        0,
        undefined,
        false,
        { mode: 'contain', onlyScaleDown: true }
      );
      
      processedUri = resizeResult.uri;
    }
    
    // Compress the image
    const compressedUri = await Image.compress(processedUri, {
      compressionMethod: 'auto',
      maxWidth: MAX_IMAGE_DIMENSION,
      maxHeight: MAX_IMAGE_DIMENSION,
      quality: IMAGE_QUALITY / 100,
    });
    
    // Check final file size
    const fileInfo = await RNFS.stat(compressedUri);
    const fileSizeMB = fileInfo.size / (1024 * 1024);
    
    if (fileSizeMB > MAX_IMAGE_SIZE_MB) {
      // Further compress if still too large
      const extraCompressedUri = await Image.compress(compressedUri, {
        compressionMethod: 'auto',
        maxWidth: MAX_IMAGE_DIMENSION,
        maxHeight: MAX_IMAGE_DIMENSION,
        quality: (IMAGE_QUALITY - 20) / 100, // Lower quality for larger files
      });
      
      return {
        uri: extraCompressedUri,
        type: 'image/jpeg',
        name: image.fileName || `image_${Date.now()}.jpg`,
        width: newWidth || image.width,
        height: newHeight || image.height,
      };
    }
    
    return {
      uri: compressedUri,
      type: 'image/jpeg',
      name: image.fileName || `image_${Date.now()}.jpg`,
      width: newWidth || image.width,
      height: newHeight || image.height,
    };
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
};

/**
 * Create a thumbnail from an image
 * @param {string} imageUri - URI of the image
 * @returns {Promise<string>} URI of the thumbnail
 */
export const createImageThumbnail = async (imageUri) => {
  try {
    // Resize the image to thumbnail size
    const result = await ImageResizer.createResizedImage(
      imageUri,
      MAX_THUMBNAIL_DIMENSION,
      MAX_THUMBNAIL_DIMENSION,
      'JPEG',
      70,
      0,
      undefined,
      false,
      { mode: 'contain', onlyScaleDown: true }
    );
    
    return result.uri;
  } catch (error) {
    console.error('Error creating image thumbnail:', error);
    throw error;
  }
};

/**
 * Process a video before upload (resize, compress, create thumbnail)
 * @param {Object} video - Video object from video picker
 * @returns {Promise<Object>} Processed video with thumbnail
 */
export const processVideo = async (video) => {
  if (!video || !video.uri) {
    throw new Error('Invalid video object');
  }
  
  try {
    // Check video duration if available
    if (video.duration && video.duration > MAX_VIDEO_DURATION_SEC * 1000) {
      throw new Error(`Video duration exceeds the maximum limit of ${MAX_VIDEO_DURATION_SEC} seconds`);
    }
    
    // Original file size
    const fileInfo = await RNFS.stat(video.uri);
    const fileSizeMB = fileInfo.size / (1024 * 1024);
    
    // Compression required if file is too large
    const needsCompression = fileSizeMB > MAX_VIDEO_SIZE_MB;
    let processedUri = video.uri;
    
    if (needsCompression) {
      if (Platform.OS === 'android') {
        // For Android, use FFmpeg for more reliable processing
        const outputPath = `${RNFS.CachesDirectoryPath}/compressed_${Date.now()}.mp4`;
        
        // FFmpeg command for compressing video
        const command = `-i ${video.uri} -vf "scale='min(${MAX_VIDEO_DIMENSION},iw)':'min(${MAX_VIDEO_DIMENSION},ih)'" -c:v libx264 -preset fast -crf 28 -c:a aac -b:a 128k -movflags +faststart ${outputPath}`;
        
        // Execute the command
        await FFmpegKit.execute(command);
        
        // Check if output file exists
        const exists = await RNFS.exists(outputPath);
        if (!exists) {
          throw new Error('Video compression failed');
        }
        
        processedUri = outputPath;
      } else {
        // For iOS, use react-native-compressor
        processedUri = await Video.compress(
          video.uri,
          {
            compressionMethod: 'auto',
            maxSize: MAX_VIDEO_SIZE_MB * 1024 * 1024, // Convert to bytes
            minimumFileSizeForCompress: 1024 * 1024, // 1MB minimum
          }
        );
      }
    }
    
    // Create thumbnail
    const thumbnail = await createThumbnail({
      url: processedUri,
      timeStamp: 1000, // 1 second into the video
      quality: 0.8,
      cacheName: `thumb_${Date.now()}`,
    });
    
    // Check final file size after compression
    const finalFileInfo = await RNFS.stat(processedUri);
    const finalFileSizeMB = finalFileInfo.size / (1024 * 1024);
    
    if (finalFileSizeMB > MAX_VIDEO_SIZE_MB * 1.5) {
      throw new Error(`Video is too large (${finalFileSizeMB.toFixed(2)} MB) even after compression`);
    }
    
    return {
      uri: processedUri,
      thumbnailUri: thumbnail.path,
      type: 'video/mp4',
      name: video.fileName || `video_${Date.now()}.mp4`,
      size: finalFileInfo.size,
    };
  } catch (error) {
    console.error('Error processing video:', error);
    throw error;
  }
};

/**
 * Check if a file is too large for upload
 * @param {number} fileSize - File size in bytes
 * @param {string} fileType - MIME type of the file
 * @returns {boolean} Whether the file is too large
 */
export const isFileTooLarge = (fileSize, fileType) => {
  const fileSizeMB = fileSize / (1024 * 1024);
  if (fileType.startsWith('image')) {
    return fileSizeMB > MAX_IMAGE_SIZE_MB;
  } else if (fileType.startsWith('video')) {
    return fileSizeMB > MAX_VIDEO_SIZE_MB;
  }
  // Default to true for unknown file types
  return true;
};

/**
 * Get file extension from mime type
 * @param {string} mimeType - MIME type
 * @returns {string} File extension
 */
export const getFileExtensionFromMimeType = (mimeType) => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    case 'video/mp4':
      return 'mp4';
    case 'video/quicktime':
      return 'mov';
    case 'video/x-msvideo':
      return 'avi';
    default:
      return 'dat';
  }
};

export default {
  processImage,
  createImageThumbnail,
  processVideo,
  isFileTooLarge,
  getFileExtensionFromMimeType,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SIZE_MB,
  MAX_VIDEO_DURATION_SEC,
};

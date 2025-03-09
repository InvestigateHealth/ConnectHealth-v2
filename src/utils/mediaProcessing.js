// src/utils/mediaProcessing.js
// Utility functions for processing images and videos

import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import ImagePicker from 'react-native-image-crop-picker';
import { createThumbnail } from 'react-native-create-thumbnail';
import ffmpegKit from 'ffmpeg-kit-react-native';

// Max dimensions for images
const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 1200;

// Max dimensions for thumbnails
const MAX_THUMBNAIL_WIDTH = 300;
const MAX_THUMBNAIL_HEIGHT = 300;

// Max video size in bytes (20MB)
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;

// Max video duration in seconds
const MAX_VIDEO_DURATION = 120;

// MIME types for common image formats
const IMAGE_MIME_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
};

// MIME types for common video formats
const VIDEO_MIME_TYPES = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  '3gp': 'video/3gpp',
};

/**
 * Process an image for upload (resize, compress, convert)
 * @param {Object} imageAsset - Image asset from image picker
 * @returns {Promise<Object>} Processed image info
 */
export const processImage = async (imageAsset) => {
  try {
    // Determine if we need to resize
    const needsResize = 
      (imageAsset.width > MAX_IMAGE_WIDTH || imageAsset.height > MAX_IMAGE_HEIGHT);
    
    // Check if the image needs conversion (HEIC/HEIF to JPEG)
    const needsConversion = 
      imageAsset.type === 'image/heic' || 
      imageAsset.type === 'image/heif' ||
      (imageAsset.uri && (
        imageAsset.uri.toLowerCase().endsWith('heic') ||
        imageAsset.uri.toLowerCase().endsWith('heif')
      ));
    
    // Early return if no processing needed
    if (!needsResize && !needsConversion) {
      return imageAsset;
    }
    
    // Generate a target width and height that maintains aspect ratio
    let targetWidth = imageAsset.width;
    let targetHeight = imageAsset.height;
    
    if (needsResize) {
      const aspectRatio = imageAsset.width / imageAsset.height;
      
      if (imageAsset.width > imageAsset.height) {
        // Landscape orientation
        targetWidth = Math.min(imageAsset.width, MAX_IMAGE_WIDTH);
        targetHeight = Math.round(targetWidth / aspectRatio);
      } else {
        // Portrait orientation
        targetHeight = Math.min(imageAsset.height, MAX_IMAGE_HEIGHT);
        targetWidth = Math.round(targetHeight * aspectRatio);
      }
    }
    
    // Determine output format - convert HEIC/HEIF to JPEG
    const outputFormat = needsConversion ? 'JPEG' : 
      (imageAsset.type === 'image/png' ? 'PNG' : 'JPEG');
    
    // Resize and possibly convert format
    const processedImage = await ImageResizer.createResizedImage(
      imageAsset.uri,
      targetWidth,
      targetHeight,
      outputFormat,
      90, // quality
      0, // rotation
      null, // output path (null = temp directory)
      false, // keep metadata
      { onlyScaleDown: true } // options
    );
    
    // Get file size of the processed image
    const fileInfo = await RNFS.stat(processedImage.uri);
    
    return {
      uri: processedImage.uri,
      width: processedImage.width,
      height: processedImage.height,
      type: outputFormat === 'JPEG' ? 'image/jpeg' : 'image/png',
      name: processedImage.name || `image_${Date.now()}.${outputFormat.toLowerCase()}`,
      size: fileInfo.size,
    };
  } catch (error) {
    console.error('Error processing image:', error);
    // If processing fails, return the original image
    return imageAsset;
  }
};

/**
 * Process a video for upload (compress, convert, generate thumbnail)
 * @param {Object} videoAsset - Video asset from picker
 * @returns {Promise<Object>} Processed video info with thumbnail
 */
export const processVideo = async (videoAsset) => {
  try {
    // Check if video needs processing (too large or unsupported format)
    const needsProcessing = 
      videoAsset.fileSize > MAX_VIDEO_SIZE ||
      (videoAsset.duration && videoAsset.duration > MAX_VIDEO_DURATION * 1000) ||
      (Platform.OS === 'ios' && videoAsset.uri.toLowerCase().endsWith('mov'));
    
    let processedVideo = { ...videoAsset };
    
    if (needsProcessing) {
      // Generate a unique output path
      const timestamp = Date.now();
      const outputPath = `${RNFS.CachesDirectoryPath}/processed_video_${timestamp}.mp4`;
      
      // Determine the target duration
      const targetDuration = Math.min(
        videoAsset.duration ? videoAsset.duration / 1000 : MAX_VIDEO_DURATION,
        MAX_VIDEO_DURATION
      );
      
      // Build FFmpeg command
      let command = `-i "${videoAsset.uri}" -c:v libx264 -preset medium -crf 28 -c:a aac -b:a 128k`;
      
      // Add duration limit if needed
      if (videoAsset.duration && videoAsset.duration > MAX_VIDEO_DURATION * 1000) {
        command = `${command} -t ${targetDuration}`;
      }
      
      // Add output options
      command = `${command} -movflags +faststart -pix_fmt yuv420p "${outputPath}"`;
      
      // Execute FFmpeg command to process video
      const result = await ffmpegKit.execute(command);
      
      if (result.getReturnCode() === 0) {
        // Processing successful, get info about the processed file
        const fileInfo = await RNFS.stat(outputPath);
        
        processedVideo = {
          uri: outputPath,
          type: 'video/mp4',
          fileSize: fileInfo.size,
          duration: videoAsset.duration > MAX_VIDEO_DURATION * 1000 ? 
            MAX_VIDEO_DURATION * 1000 : videoAsset.duration,
          name: `video_${timestamp}.mp4`,
        };
      } else {
        console.warn('Video processing failed, using original video');
      }
    }
    
    // Generate a thumbnail for the video
    const thumbnail = await createThumbnail({
      url: processedVideo.uri,
      timeStamp: 1000, // 1 second into the video
      quality: 0.8,
    });
    
    // Resize thumbnail if needed
    let thumbnailInfo = thumbnail;
    
    if (thumbnail.width > MAX_THUMBNAIL_WIDTH || thumbnail.height > MAX_THUMBNAIL_HEIGHT) {
      const aspectRatio = thumbnail.width / thumbnail.height;
      let targetWidth, targetHeight;
      
      if (thumbnail.width > thumbnail.height) {
        targetWidth = MAX_THUMBNAIL_WIDTH;
        targetHeight = Math.round(targetWidth / aspectRatio);
      } else {
        targetHeight = MAX_THUMBNAIL_HEIGHT;
        targetWidth = Math.round(targetHeight * aspectRatio);
      }
      
      const resizedThumbnail = await ImageResizer.createResizedImage(
        thumbnail.path,
        targetWidth,
        targetHeight,
        'JPEG',
        80,
        0,
        null,
        false
      );
      
      thumbnailInfo = {
        ...thumbnail,
        path: resizedThumbnail.uri,
        width: resizedThumbnail.width,
        height: resizedThumbnail.height,
      };
    }
    
    return {
      ...processedVideo,
      thumbnail: thumbnailInfo.path,
      thumbnailWidth: thumbnailInfo.width,
      thumbnailHeight: thumbnailInfo.height,
    };
  } catch (error) {
    console.error('Error processing video:', error);
    
    // If video processing fails, try to at least generate a thumbnail
    try {
      const thumbnail = await createThumbnail({
        url: videoAsset.uri,
        timeStamp: 1000,
      });
      
      return {
        ...videoAsset,
        thumbnail: thumbnail.path,
        thumbnailWidth: thumbnail.width,
        thumbnailHeight: thumbnail.height,
      };
    } catch (thumbError) {
      console.error('Error generating thumbnail:', thumbError);
      // Return the original video if all processing fails
      return videoAsset;
    }
  }
};

/**
 * Get the MIME type for a file based on extension
 * @param {string} path - File path
 * @returns {string} MIME type or fallback
 */
export const getMimeType = (path) => {
  if (!path) return 'application/octet-stream';
  
  const extension = path.split('.').pop().toLowerCase();
  
  if (IMAGE_MIME_TYPES[extension]) {
    return IMAGE_MIME_TYPES[extension];
  }
  
  if (VIDEO_MIME_TYPES[extension]) {
    return VIDEO_MIME_TYPES[extension];
  }
  
  return 'application/octet-stream';
};

/**
 * Check if a file is an image based on path or MIME type
 * @param {string} path - File path
 * @param {string} mimeType - Optional MIME type
 * @returns {boolean} True if the file is an image
 */
export const isImage = (path, mimeType) => {
  if (!path) return false;
  
  if (mimeType) {
    return mimeType.startsWith('image/');
  }
  
  const extension = path.split('.').pop().toLowerCase();
  return Object.keys(IMAGE_MIME_TYPES).includes(extension);
};

/**
 * Check if a file is a video based on path or MIME type
 * @param {string} path - File path
 * @param {string} mimeType - Optional MIME type
 * @returns {boolean} True if the file is a video
 */
export const isVideo = (path, mimeType) => {
  if (!path) return false;
  
  if (mimeType) {
    return mimeType.startsWith('video/');
  }
  
  const extension = path.split('.').pop().toLowerCase();
  return Object.keys(VIDEO_MIME_TYPES).includes(extension);
};

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};

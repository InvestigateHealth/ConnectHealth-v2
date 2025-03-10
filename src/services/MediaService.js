// src/services/MediaService.js
// Comprehensive media handling service for images and videos

import { Platform } from 'react-native';
import ImageResizer from 'react-native-image-resizer';
import ImagePicker from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import uuid from 'react-native-uuid';
import { createThumbnail } from 'react-native-create-thumbnail';
import FFmpegKit from 'ffmpeg-kit-react-native';
import Config from 'react-native-config';
import { AnalyticsService } from './AnalyticsService';
import PermissionService from './PermissionService';
import ApiClient from './ApiClient';

// Parse configuration
const MAX_IMAGE_DIMENSIONS = parseInt(Config.MAX_IMAGE_DIMENSIONS || '3840', 10);
const MAX_IMAGE_SIZE_MB = parseInt(Config.MAX_IMAGE_SIZE_MB || '10', 10);
const MAX_VIDEO_DURATION_SECONDS = parseInt(Config.MAX_VIDEO_DURATION_SECONDS || '300', 10);
const MAX_VIDEO_SIZE_MB = parseInt(Config.MAX_VIDEO_SIZE_MB || '100', 10);

// Parse allowed file types
const ALLOWED_IMAGE_TYPES = (Config.ALLOWED_IMAGE_TYPES || 'jpg,jpeg,png,gif,heic').split(',');
const ALLOWED_VIDEO_TYPES = (Config.ALLOWED_VIDEO_TYPES || 'mp4,mov,m4v').split(',');

class MediaService {
  /**
   * Pick an image from the gallery or camera
   * @param {object} options Options for image picking
   * @returns {Promise<object>} The selected image
   */
  async pickImage(options = {}) {
    try {
      // Default options
      const opts = {
        maxWidth: MAX_IMAGE_DIMENSIONS,
        maxHeight: MAX_IMAGE_DIMENSIONS,
        quality: 0.9,
        mediaType: 'photo',
        includeBase64: false,
        saveToPhotos: false,
        selectionLimit: 1,
        ...options,
      };
      
      // Request permissions first
      const source = opts.source || 'gallery';
      const permissionType = source === 'camera' ? 'camera' : 'photoLibrary';
      
      const permissionResult = await PermissionService.requestPermission(permissionType);
      
      if (!permissionResult.granted) {
        throw new Error(`${permissionType} permission not granted`);
      }
      
      // Prepare picker options
      const pickerOptions = {
        mediaType: opts.mediaType,
        maxWidth: opts.maxWidth,
        maxHeight: opts.maxHeight,
        quality: opts.quality,
        includeBase64: opts.includeBase64,
        saveToPhotos: opts.saveToPhotos,
        selectionLimit: opts.selectionLimit,
      };
      
      // Launch the picker
      let result;
      
      if (source === 'camera') {
        result = await ImagePicker.launchCamera(pickerOptions);
      } else {
        result = await ImagePicker.launchImageLibrary(pickerOptions);
      }
      
      if (result.didCancel) {
        throw new Error('Image selection canceled');
      }
      
      if (result.errorCode) {
        throw new Error(`Image selection error: ${result.errorMessage}`);
      }
      
      // Get the selected assets
      const assets = result.assets || [];
      
      if (assets.length === 0) {
        throw new Error('No image selected');
      }
      
      // Get the first asset (or multiple if selectionLimit > 1)
      const selectedAssets = opts.selectionLimit === 1 ? [assets[0]] : assets;
      
      // Process each selected asset
      const processedAssets = [];
      
      for (const asset of selectedAssets) {
        // Validate file size
        const fileSizeMB = asset.fileSize / (1024 * 1024);
        
        if (fileSizeMB > MAX_IMAGE_SIZE_MB) {
          throw new Error(`Image size exceeds maximum allowed size of ${MAX_IMAGE_SIZE_MB}MB`);
        }
        
        // Validate file type
        const fileType = asset.type?.split('/')[1] || '';
        
        if (!ALLOWED_IMAGE_TYPES.includes(fileType.toLowerCase())) {
          throw new Error(`Image type not allowed. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`);
        }
        
        // Process HEIC/HEIF images to JPEG for better compatibility
        let processedAsset = asset;
        
        if (asset.type?.includes('heic') || asset.type?.includes('heif') || asset.uri?.toLowerCase().endsWith('.heic') || asset.uri?.toLowerCase().endsWith('.heif')) {
          processedAsset = await this.convertHeicToJpeg(asset);
        }
        
        // Resize large images if needed
        if (asset.width > MAX_IMAGE_DIMENSIONS || asset.height > MAX_IMAGE_DIMENSIONS) {
          processedAsset = await this.resizeImage(processedAsset, MAX_IMAGE_DIMENSIONS, MAX_IMAGE_DIMENSIONS);
        }
        
        processedAssets.push(processedAsset);
      }
      
      // Log success
      AnalyticsService.logEvent('image_picked', {
        source,
        count: processedAssets.length,
      });
      
      return opts.selectionLimit === 1 ? processedAssets[0] : processedAssets;
    } catch (error) {
      console.error('Error picking image:', error);
      AnalyticsService.logError(error, { context: 'pick_image' });
      throw error;
    }
  }
  
  /**
   * Pick a video from the gallery or camera
   * @param {object} options Options for video picking
   * @returns {Promise<object>} The selected video
   */
  async pickVideo(options = {}) {
    try {
      // Default options
      const opts = {
        mediaType: 'video',
        durationLimit: MAX_VIDEO_DURATION_SECONDS,
        saveToPhotos: false,
        quality: 'high', // high, medium, low
        ...options,
      };
      
      // Request permissions first
      const source = opts.source || 'gallery';
      const permissionTypes = source === 'camera' ? ['camera', 'microphone'] : ['photoLibrary'];
      
      for (const permType of permissionTypes) {
        const permResult = await PermissionService.requestPermission(permType);
        if (!permResult.granted) {
          throw new Error(`${permType} permission not granted`);
        }
      }
      
      // Prepare picker options
      const pickerOptions = {
        mediaType: 'video',
        videoQuality: opts.quality,
        durationLimit: opts.durationLimit,
        saveToPhotos: opts.saveToPhotos,
      };
      
      // Launch the picker
      let result;
      
      if (source === 'camera') {
        result = await ImagePicker.launchCamera(pickerOptions);
      } else {
        result = await ImagePicker.launchImageLibrary(pickerOptions);
      }
      
      if (result.didCancel) {
        throw new Error('Video selection canceled');
      }
      
      if (result.errorCode) {
        throw new Error(`Video selection error: ${result.errorMessage}`);
      }
      
      // Get the selected assets
      const assets = result.assets || [];
      
      if (assets.length === 0) {
        throw new Error('No video selected');
      }
      
      const video = assets[0];
      
      // Validate file size
      const fileSizeMB = video.fileSize / (1024 * 1024);
      
      if (fileSizeMB > MAX_VIDEO_SIZE_MB) {
        throw new Error(`Video size exceeds maximum allowed size of ${MAX_VIDEO_SIZE_MB}MB`);
      }
      
      // Validate file type
      const fileType = video.type?.split('/')[1] || '';
      
      if (!ALLOWED_VIDEO_TYPES.includes(fileType.toLowerCase())) {
        throw new Error(`Video type not allowed. Allowed types: ${ALLOWED_VIDEO_TYPES.join(', ')}`);
      }
      
      // Generate a thumbnail
      const thumbnail = await this.generateVideoThumbnail(video.uri);
      
      // Return the video with its thumbnail
      const result = {
        ...video,
        thumbnail,
      };
      
      // Log success
      AnalyticsService.logEvent('video_picked', {
        source,
        duration: video.duration,
        size: fileSizeMB,
      });
      
      return result;
    } catch (error) {
      console.error('Error picking video:', error);
      AnalyticsService.logError(error, { context: 'pick_video' });
      throw error;
    }
  }
  
  /**
   * Convert HEIC/HEIF image to JPEG
   * @param {object} image The image to convert
   * @returns {Promise<object>} The converted image
   */
  async convertHeicToJpeg(image) {
    try {
      // Create a unique filename
      const filename = `${uuid.v4()}.jpg`;
      const outputPath = `${RNFS.CachesDirectoryPath}/${filename}`;
      
      // Use ImageResizer to convert and save the image
      const result = await ImageResizer.createResizedImage(
        image.uri,
        image.width,
        image.height,
        'JPEG',
        90, // quality
        0, // rotation
        outputPath
      );
      
      // Get file size
      const fileInfo = await RNFS.stat(outputPath);
      
      return {
        ...image,
        uri: result.uri,
        type: 'image/jpeg',
        fileName: filename,
        fileSize: parseInt(fileInfo.size, 10),
      };
    } catch (error) {
      console.error('Error converting HEIC to JPEG:', error);
      AnalyticsService.logError(error, { context: 'convert_heic_to_jpeg' });
      
      // Return the original image if conversion fails
      return image;
    }
  }
  
  /**
   * Resize an image
   * @param {object} image The image to resize
   * @param {number} maxWidth Maximum width
   * @param {number} maxHeight Maximum height
   * @returns {Promise<object>} The resized image
   */
  async resizeImage(image, maxWidth, maxHeight) {
    try {
      // Create a unique filename with original extension
      const extension = image.type?.split('/')[1] || 'jpg';
      const filename = `${uuid.v4()}.${extension}`;
      const outputPath = `${RNFS.CachesDirectoryPath}/${filename}`;
      
      // Calculate new dimensions while maintaining aspect ratio
      const aspectRatio = image.width / image.height;
      
      let newWidth = image.width;
      let newHeight = image.height;
      
      if (newWidth > maxWidth) {
        newWidth = maxWidth;
        newHeight = newWidth / aspectRatio;
      }
      
      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = newHeight * aspectRatio;
      }
      
      // Round dimensions to integers
      newWidth = Math.floor(newWidth);
      newHeight = Math.floor(newHeight);
      
      // Use ImageResizer to resize and save the image
      const result = await ImageResizer.createResizedImage(
        image.uri,
        newWidth,
        newHeight,
        extension.toUpperCase(),
        90, // quality
        0, // rotation
        outputPath
      );
      
      // Get file size
      const fileInfo = await RNFS.stat(outputPath);
      
      return {
        ...image,
        uri: result.uri,
        width: newWidth,
        height: newHeight,
        fileName: filename,
        fileSize: parseInt(fileInfo.size, 10),
      };
    } catch (error) {
      console.error('Error resizing image:', error);
      AnalyticsService.logError(error, { context: 'resize_image' });
      
      // Return the original image if resizing fails
      return image;
    }
  }
  
  /**
   * Generate a thumbnail for a video
   * @param {string} videoUri URI of the video
   * @returns {Promise<string>} URI of the generated thumbnail
   */
  async generateVideoThumbnail(videoUri) {
    try {
      // Create a thumbnail at 00:00:01
      const result = await createThumbnail({
        url: videoUri,
        timeStamp: 1000, // 1 second into the video
        quality: 0.8,
      });
      
      return result.path;
    } catch (error) {
      console.error('Error generating video thumbnail:', error);
      AnalyticsService.logError(error, { context: 'generate_video_thumbnail' });
      
      // Return null if thumbnail generation fails
      return null;
    }
  }
  
  /**
   * Compress a video
   * @param {object} video The video to compress
   * @param {object} options Compression options
   * @returns {Promise<object>} The compressed video
   */
  async compressVideo(video, options = {}) {
    try {
      // Default options
      const opts = {
        quality: 'medium', // high, medium, low
        maxBitrate: 2000000, // 2 Mbps
        ...options,
      };
      
      // Create output path
      const filename = `${uuid.v4()}.mp4`;
      const outputPath = `${RNFS.CachesDirectoryPath}/${filename}`;
      
      let bitrateParam;
      
      switch (opts.quality) {
        case 'high':
          bitrateParam = '4000k';
          break;
        case 'low':
          bitrateParam = '1000k';
          break;
        case 'medium':
        default:
          bitrateParam = '2000k';
          break;
      }
      
      // Compress the video using FFmpeg
      const command = `-i "${video.uri}" -c:v libx264 -b:v ${bitrateParam} -c:a aac -strict experimental "${outputPath}"`;
      
      const session = await FFmpegKit.execute(command);
      const returnCode = await session.getReturnCode();
      
      if (returnCode.isSuccess()) {
        // Get file info
        const fileInfo = await RNFS.stat(outputPath);
        
        // Generate a new thumbnail
        const thumbnail = await this.generateVideoThumbnail(outputPath);
        
        return {
          ...video,
          uri: outputPath,
          fileName: filename,
          fileSize: parseInt(fileInfo.size, 10),
          compressed: true,
          thumbnail,
        };
      } else {
        // If compression fails, return the original video
        console.warn('Video compression failed, using original video');
        return video;
      }
    } catch (error) {
      console.error('Error compressing video:', error);
      AnalyticsService.logError(error, { context: 'compress_video' });
      
      // Return the original video if compression fails
      return video;
    }
  }
  
  /**
   * Upload media to the server
   * @param {object} media The media to upload
   * @param {object} options Upload options
   * @returns {Promise<object>} The uploaded media data
   */
  async uploadMedia(media, options = {}) {
    try {
      // Default options
      const opts = {
        mediaType: media.type?.includes('video') ? 'video' : 'image',
        endpoint: '/media/upload',
        compress: true,
        metadata: {},
        progressCallback: null,
        ...options,
      };
      
      let mediaToUpload = media;
      
      // Compress video if needed
      if (opts.mediaType === 'video' && opts.compress) {
        mediaToUpload = await this.compressVideo(media);
      }
      
      // Prepare additional fields
      const additionalFields = {
        mediaType: opts.mediaType,
        ...opts.metadata,
      };
      
      // Upload the media using the API client
      const response = await ApiClient.uploadFile(
        opts.endpoint,
        mediaToUpload,
        'media',
        additionalFields,
        opts.progressCallback
      );
      
      // Log success
      AnalyticsService.logEvent('media_uploaded', {
        mediaType: opts.mediaType,
        fileSize: mediaToUpload.fileSize,
        compressed: !!mediaToUpload.compressed,
      });
      
      return response;
    } catch (error) {
      console.error('Error uploading media:', error);
      AnalyticsService.logError(error, { context: 'upload_media' });
      throw error;
    }
  }
  
  /**
   * Get a sanitized file extension from a URI or MIME type
   * @param {string} uri The media URI
   * @param {string} mimeType The MIME type
   * @returns {string} The file extension
   */
  getFileExtension(uri, mimeType) {
    // Try to get extension from URI
    if (uri) {
      const uriParts = uri.split('.');
      if (uriParts.length > 1) {
        const extension = uriParts.pop().toLowerCase();
        if (extension.length <= 4) {
          return extension;
        }
      }
    }
    
    // Try to get extension from MIME type
    if (mimeType) {
      const typeParts = mimeType.split('/');
      if (typeParts.length === 2) {
        const subtype = typeParts[1].toLowerCase();
        
        // Handle special cases
        switch (subtype) {
          case 'jpeg':
            return 'jpg';
          case 'quicktime':
            return 'mov';
          default:
            // Use the subtype if it's simple
            if (subtype.length <= 4 && !subtype.includes('+')) {
              return subtype;
            }
        }
      }
    }
    
    // Default extensions based on media type
    if (mimeType?.startsWith('image/')) {
      return 'jpg';
    } else if (mimeType?.startsWith('video/')) {
      return 'mp4';
    }
    
    // Fallback
    return 'bin';
  }
}

export default new MediaService();

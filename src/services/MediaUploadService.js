// src/services/MediaUploadService.js
import { Platform } from 'react-native';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import ImageResizer from 'react-native-image-resizer';
import ImageCropPicker from 'react-native-image-crop-picker';
import { createThumbnail } from 'react-native-create-thumbnail';
import { FFmpegKit } from 'ffmpeg-kit-react-native';
import uuid from 'react-native-uuid';
import RNFS from 'react-native-fs';
import { AnalyticsService } from './AnalyticsService';

/**
 * Service for handling media uploads (images, videos)
 * Supports different quality levels, resizing, and processing
 */
class MediaUploadService {
  /**
   * Launch camera to capture a photo
   * @param {Object} options - Camera options
   * @returns {Promise<Object>} - Selected media object
   */
  async capturePhoto(options = {}) {
    const defaultOptions = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 1920,
      maxWidth: 1920,
      quality: 0.8,
      saveToPhotos: false,
    };
    
    try {
      const result = await launchCamera({
        ...defaultOptions,
        ...options,
      });
      
      if (result.didCancel) {
        return { cancelled: true };
      }
      
      if (result.errorCode) {
        throw new Error(`Image capture error: ${result.errorMessage}`);
      }
      
      return {
        uri: result.assets[0].uri,
        type: result.assets[0].type,
        name: result.assets[0].fileName || `photo_${Date.now()}.jpg`,
        width: result.assets[0].width,
        height: result.assets[0].height,
        fileSize: result.assets[0].fileSize,
      };
    } catch (error) {
      console.error('Error capturing photo:', error);
      throw error;
    }
  }
  
  /**
   * Launch camera to record a video
   * @param {Object} options - Camera options
   * @returns {Promise<Object>} - Selected media object
   */
  async recordVideo(options = {}) {
    const defaultOptions = {
      mediaType: 'video',
      videoQuality: 'high',
      durationLimit: 60,
      saveToPhotos: false,
    };
    
    try {
      const result = await launchCamera({
        ...defaultOptions,
        ...options,
      });
      
      if (result.didCancel) {
        return { cancelled: true };
      }
      
      if (result.errorCode) {
        throw new Error(`Video recording error: ${result.errorMessage}`);
      }
      
      return {
        uri: result.assets[0].uri,
        type: result.assets[0].type,
        name: result.assets[0].fileName || `video_${Date.now()}.mp4`,
        duration: result.assets[0].duration || 0,
        fileSize: result.assets[0].fileSize,
      };
    } catch (error) {
      console.error('Error recording video:', error);
      throw error;
    }
  }
  
  /**
   * Launch image picker to select photos
   * @param {Object} options - Image picker options
   * @returns {Promise<Object>} - Selected media object(s)
   */
  async pickImages(options = {}) {
    const defaultOptions = {
      mediaType: 'photo',
      selectionLimit: 1,
      includeBase64: false,
      maxHeight: 1920,
      maxWidth: 1920,
      quality: 0.8,
    };
    
    try {
      const result = await launchImageLibrary({
        ...defaultOptions,
        ...options,
      });
      
      if (result.didCancel) {
        return { cancelled: true };
      }
      
      if (result.errorCode) {
        throw new Error(`Image selection error: ${result.errorMessage}`);
      }
      
      // If multiple selection is allowed, return array of objects
      if (options.selectionLimit > 1 || options.selectionLimit === 0) {
        return result.assets.map(asset => ({
          uri: asset.uri,
          type: asset.type,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          width: asset.width,
          height: asset.height,
          fileSize: asset.fileSize,
        }));
      }
      
      // Otherwise, return a single object
      return {
        uri: result.assets[0].uri,
        type: result.assets[0].type,
        name: result.assets[0].fileName || `image_${Date.now()}.jpg`,
        width: result.assets[0].width,
        height: result.assets[0].height,
        fileSize: result.assets[0].fileSize,
      };
    } catch (error) {
      console.error('Error picking images:', error);
      throw error;
    }
  }
  
  /**
   * Launch image picker to select videos
   * @param {Object} options - Video picker options
   * @returns {Promise<Object>} - Selected media object(s)
   */
  async pickVideos(options = {}) {
    const defaultOptions = {
      mediaType: 'video',
      selectionLimit: 1,
    };
    
    try {
      const result = await launchImageLibrary({
        ...defaultOptions,
        ...options,
      });
      
      if (result.didCancel) {
        return { cancelled: true };
      }
      
      if (result.errorCode) {
        throw new Error(`Video selection error: ${result.errorMessage}`);
      }
      
      // If multiple selection is allowed, return array of objects
      if (options.selectionLimit > 1 || options.selectionLimit === 0) {
        return result.assets.map(asset => ({
          uri: asset.uri,
          type: asset.type,
          name: asset.fileName || `video_${Date.now()}.mp4`,
          duration: asset.duration || 0,
          fileSize: asset.fileSize,
        }));
      }
      
      // Otherwise, return a single object
      return {
        uri: result.assets[0].uri,
        type: result.assets[0].type,
        name: result.assets[0].fileName || `video_${Date.now()}.mp4`,
        duration: result.assets[0].duration || 0,
        fileSize: result.assets[0].fileSize,
      };
    } catch (error) {
      console.error('Error picking videos:', error);
      throw error;
    }
  }
  
  /**
   * Resize an image to a specific size
   * @param {string} uri - Image URI
   * @param {number} maxWidth - Maximum width
   * @param {number} maxHeight - Maximum height
   * @param {number} quality - Image quality (0-100)
   * @returns {Promise<Object>} - Resized image object
   */
  async resizeImage(uri, maxWidth = 1080, maxHeight = 1080, quality = 80) {
    try {
      const result = await ImageResizer.createResizedImage(
        uri,
        maxWidth,
        maxHeight,
        'JPEG',
        quality,
        0,
        undefined,
        false,
        {
          mode: 'contain',
          onlyScaleDown: true,
        }
      );
      
      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        fileSize: result.size,
        name: result.name,
        type: 'image/jpeg',
      };
    } catch (error) {
      console.error('Error resizing image:', error);
      throw error;
    }
  }
  
  /**
   * Crop and/or rotate an image
   * @param {Object} options - Crop options
   * @returns {Promise<Object>} - Cropped image object
   */
  async cropImage(options = {}) {
    try {
      const defaultOptions = {
        mediaType: 'photo',
        cropping: true,
        width: 1080,
        height: 1080,
        cropperCircleOverlay: false,
        compressImageQuality: 0.8,
        freeStyleCropEnabled: true,
      };
      
      const result = await ImageCropPicker.openPicker({
        ...defaultOptions,
        ...options,
      });
      
      return {
        uri: result.path,
        width: result.width,
        height: result.height,
        type: result.mime,
        fileSize: result.size,
        name: `cropped_${Date.now()}.jpg`,
      };
    } catch (error) {
      if (error.code === 'E_PICKER_CANCELLED') {
        return { cancelled: true };
      }
      console.error('Error cropping image:', error);
      throw error;
    }
  }
  
  /**
   * Generate a thumbnail from a video
   * @param {string} videoUri - Video URI
   * @param {Object} options - Thumbnail options
   * @returns {Promise<Object>} - Thumbnail object
   */
  async generateVideoThumbnail(videoUri, options = {}) {
    try {
      const defaultOptions = {
        timeStamp: 1000, // 1 second into the video
        quality: 0.8,
      };
      
      const result = await createThumbnail({
        url: videoUri,
        ...defaultOptions,
        ...options,
      });
      
      return {
        uri: result.path,
        width: result.width,
        height: result.height,
        type: 'image/jpeg',
        name: `thumbnail_${Date.now()}.jpg`,
      };
    } catch (error) {
      console.error('Error generating video thumbnail:', error);
      throw error;
    }
  }
  
  /**
   * Process a video (compress, trim, etc.)
   * @param {string} videoUri - Video URI
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Processed video object
   */
  async processVideo(videoUri, options = {}) {
    try {
      const inputPath = videoUri;
      const outputFileName = `processed_${Date.now()}.mp4`;
      const outputPath = `${RNFS.CachesDirectoryPath}/${outputFileName}`;
      
      // Default options for video processing
      const defaultOptions = {
        bitrate: '2M',
        width: 1280,
        height: 720,
        fps: 30,
        startTime: 0,
        endTime: 0, // 0 means process the entire video
      };
      
      const processingOptions = {
        ...defaultOptions,
        ...options,
      };
      
      // Build FFmpeg command
      let command = `-i "${inputPath}" -c:v libx264 -preset medium -b:v ${processingOptions.bitrate}`;
      
      // Add scale filter if needed
      if (processingOptions.width && processingOptions.height) {
        command += ` -vf scale=${processingOptions.width}:${processingOptions.height}`;
      }
      
      // Add FPS filter if needed
      if (processingOptions.fps) {
        command += ` -r ${processingOptions.fps}`;
      }
      
      // Add trim options if needed
      if (processingOptions.startTime > 0 || processingOptions.endTime > 0) {
        if (processingOptions.startTime > 0) {
          command += ` -ss ${processingOptions.startTime}`;
        }
        
        if (processingOptions.endTime > 0) {
          command += ` -to ${processingOptions.endTime}`;
        }
      }
      
      // Finalize command
      command += ` -c:a aac -strict experimental "${outputPath}"`;
      
      // Execute FFmpeg command
      await FFmpegKit.execute(command);
      
      // Check if output file exists
      const exists = await RNFS.exists(outputPath);
      if (!exists) {
        throw new Error('Video processing failed: output file not found');
      }
      
      // Get file stats
      const stats = await RNFS.stat(outputPath);
      
      return {
        uri: `file://${outputPath}`,
        path: outputPath,
        name: outputFileName,
        type: 'video/mp4',
        fileSize: stats.size,
      };
    } catch (error) {
      console.error('Error processing video:', error);
      throw error;
    }
  }
  
  /**
   * Upload a file to Firebase Storage
   * @param {Object} file - File object with uri, name, and type
   * @param {string} path - Storage path
   * @param {function} onProgress - Progress callback
   * @returns {Promise<string>} - Download URL
   */
  async uploadFile(file, path, onProgress = null) {
    if (!file || !file.uri) {
      throw new Error('Invalid file object');
    }
    
    try {
      // Generate a unique filename if not provided
      const fileName = file.name || `file_${uuid.v4()}`;
      const storagePath = `${path}/${fileName}`;
      
      // Create a reference to the file in Firebase Storage
      const reference = storage().ref(storagePath);
      
      // Start the upload task
      const task = reference.putFile(file.uri);
      
      // Set up progress monitoring if needed
      if (onProgress) {
        task.on('state_changed', snapshot => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        });
      }
      
      // Wait for the upload to complete
      await task;
      
      // Get the download URL
      const downloadUrl = await reference.getDownloadURL();
      
      // Log successful upload
      AnalyticsService.logEvent('media_upload_success', {
        file_type: file.type,
        file_size: file.fileSize,
        storage_path: storagePath,
      });
      
      return {
        url: downloadUrl,
        path: storagePath,
        fileName: fileName,
        type: file.type,
        size: file.fileSize,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      
      // Log upload error
      AnalyticsService.logEvent('media_upload_error', {
        file_type: file.type,
        file_size: file.fileSize,
        error_message: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Upload media with associated metadata to Firestore
   * @param {Object} mediaData - Media data object
   * @param {string} userId - User ID
   * @param {string} collection - Firestore collection
   * @returns {Promise<Object>} - Uploaded media document
   */
  async uploadMediaWithMetadata(mediaData, userId, collection = 'media') {
    if (!mediaData || !userId) {
      throw new Error('Invalid media data or user ID');
    }
    
    try {
      // Upload the media file first
      const storageFolder = `users/${userId}/${collection}`;
      const uploadResult = await this.uploadFile(
        mediaData.file,
        storageFolder,
        mediaData.onProgress
      );
      
      // Prepare the metadata document
      const mediaDocument = {
        userId,
        url: uploadResult.url,
        storagePath: uploadResult.path,
        fileName: uploadResult.fileName,
        contentType: uploadResult.type,
        fileSize: uploadResult.size,
        type: mediaData.type || 'image',
        title: mediaData.title || '',
        description: mediaData.description || '',
        tags: mediaData.tags || [],
        isPrivate: mediaData.isPrivate || false,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      
      // Add thumbnail if it's a video
      if (mediaData.thumbnail) {
        const thumbnailUpload = await this.uploadFile(
          mediaData.thumbnail,
          `${storageFolder}/thumbnails`
        );
        
        mediaDocument.thumbnail = thumbnailUpload.url;
        mediaDocument.thumbnailPath = thumbnailUpload.path;
      }
      
      // Add dimensions if available
      if (mediaData.width && mediaData.height) {
        mediaDocument.width = mediaData.width;
        mediaDocument.height = mediaData.height;
        mediaDocument.aspectRatio = mediaData.width / mediaData.height;
      }
      
      // Add duration if it's a video
      if (mediaData.duration) {
        mediaDocument.duration = mediaData.duration;
      }
      
      // Create document in Firestore
      const docRef = await firestore().collection(collection).add(mediaDocument);
      
      // Log media upload to analytics
      AnalyticsService.logEvent('media_metadata_created', {
        media_id: docRef.id,
        media_type: mediaData.type || 'image',
        is_private: mediaData.isPrivate || false,
      });
      
      return {
        ...mediaDocument,
        id: docRef.id,
      };
    } catch (error) {
      console.error('Error uploading media with metadata:', error);
      
      // Log error to analytics
      AnalyticsService.logEvent('media_metadata_error', {
        error_message: error.message,
      });
      
      throw error;
    }
  }
  
  /**
   * Delete a media file and its metadata
   * @param {string} mediaId - Media document ID
   * @param {string} collection - Firestore collection
   * @returns {Promise<boolean>} - Success status
   */
  async deleteMedia(mediaId, collection = 'media') {
    if (!mediaId) {
      throw new Error('Invalid media ID');
    }
    
    try {
      // Get the media document from Firestore
      const mediaDoc = await firestore().collection(collection).doc(mediaId).get();
      
      if (!mediaDoc.exists) {
        throw new Error('Media document not found');
      }
      
      const mediaData = mediaDoc.data();
      
      // Delete the file from Storage if it exists
      if (mediaData.storagePath) {
        await storage().ref(mediaData.storagePath).delete();
      }
      
      // Delete the thumbnail if it exists
      if (mediaData.thumbnailPath) {
        await storage().ref(mediaData.thumbnailPath).delete();
      }
      
      // Delete the document from Firestore
      await firestore().collection(collection).doc(mediaId).delete();
      
      // Log deletion to analytics
      AnalyticsService.logEvent('media_deleted', {
        media_id: mediaId,
        media_type: mediaData.type || 'unknown',
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting media:', error);
      
      // Log error to analytics
      AnalyticsService.logEvent('media_deletion_error', {
        media_id: mediaId,
        error_message: error.message,
      });
      
      throw error;
    }
  }
}

// Create singleton instance
export const MediaUploadService = new MediaUploadService();

// src/services/MediaService.js
// Enhanced service for handling media uploads across platforms with better security and reliability

import { Platform, Alert } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';
import { FFmpegKit } from 'ffmpeg-kit-react-native';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import { withRetry } from './RetryService';
import { isDeviceOnline } from './NetworkService';

// Constants for media
const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 1920;
const IMAGE_QUALITY = 80;
const MAX_IMAGE_SIZE_MB = 10;
const MAX_VIDEO_SIZE_MB = 100;
const MAX_VIDEO_DURATION = 180; // 3 minutes
const MB_IN_BYTES = 1024 * 1024;

// Supported file formats
const SUPPORTED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'webp'];
const SUPPORTED_VIDEO_FORMATS = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'flv', 'wmv'];

// Mime type validation
const VALID_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/webp'
];

const VALID_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/3gpp',
  'video/x-flv',
  'video/x-ms-wmv'
];

class MediaService {
  constructor() {
    this.pendingUploads = new Map();
    this.uploadQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Initialize the media service
   */
  async initialize() {
    try {
      // Load pending uploads from AsyncStorage
      this.loadPendingUploads();
      
      // Process any pending uploads
      this.processUploadQueue();
    } catch (error) {
      console.error('Error initializing MediaService:', error);
    }
  }

  /**
   * Load pending uploads from storage
   */
  async loadPendingUploads() {
    try {
      const pendingUploadsJson = await AsyncStorage.getItem('pendingUploads');
      if (pendingUploadsJson) {
        this.uploadQueue = JSON.parse(pendingUploadsJson);
      }
    } catch (error) {
      console.error('Error loading pending uploads:', error);
      this.uploadQueue = [];
    }
  }

  /**
   * Save pending uploads to storage
   */
  async savePendingUploads() {
    try {
      await AsyncStorage.setItem('pendingUploads', JSON.stringify(this.uploadQueue));
    } catch (error) {
      console.error('Error saving pending uploads:', error);
    }
  }

  /**
   * Process the upload queue
   */
  async processUploadQueue() {
    if (this.isProcessingQueue || this.uploadQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    try {
      // Check if online
      const isOnline = await isDeviceOnline();
      if (!isOnline) {
        this.isProcessingQueue = false;
        return;
      }
      
      // Process each item in the queue
      const queue = [...this.uploadQueue];
      this.uploadQueue = [];
      
      for (const item of queue) {
        try {
          // Verify the file still exists
          const fileExists = await RNFS.exists(item.uri);
          if (!fileExists) {
            console.warn(`File not found for pending upload: ${item.uri}`);
            continue;
          }
          
          // Upload the file
          const url = await this.uploadMediaInternal(
            item.uri, 
            item.path, 
            item.mediaType, 
            (progress) => {
              if (item.onProgress) {
                item.onProgress(progress);
              }
            }
          );
          
          // Call success callback if defined
          if (item.onSuccess && typeof item.onSuccess === 'function') {
            item.onSuccess(url);
          }
        } catch (error) {
          console.error('Error processing queued upload:', error);
          
          // If retryable and under max attempts, re-queue
          if (item.attempts < 3) {
            this.uploadQueue.push({
              ...item,
              attempts: (item.attempts || 0) + 1
            });
          } else if (item.onError && typeof item.onError === 'function') {
            item.onError(error);
          }
        }
      }
      
      // Save any re-queued items
      if (this.uploadQueue.length > 0) {
        await this.savePendingUploads();
      }
    } catch (error) {
      console.error('Error processing upload queue:', error);
    } finally {
      this.isProcessingQueue = false;
      
      // If there are still items in the queue, try again later
      if (this.uploadQueue.length > 0) {
        setTimeout(() => this.processUploadQueue(), 60000); // Try again in 1 minute
      }
    }
  }

  /**
   * Validate a file based on its mime type and size
   * 
   * @param {Object} fileData - File data to validate
   * @param {string} mediaType - Type of media ('photo' or 'video')
   * @returns {boolean} Whether the file is valid
   */
  validateFile(fileData, mediaType) {
    if (!fileData) return false;
    
    // Validate mime type
    const validMimeTypes = mediaType === 'photo' ? VALID_IMAGE_MIME_TYPES : VALID_VIDEO_MIME_TYPES;
    if (!validMimeTypes.includes(fileData.mime)) {
      console.error(`Invalid mime type: ${fileData.mime}`);
      return false;
    }
    
    // Validate file size
    const maxSize = mediaType === 'photo' ? MAX_IMAGE_SIZE_MB : MAX_VIDEO_SIZE_MB;
    if (fileData.size > maxSize * MB_IN_BYTES) {
      console.error(`File too large: ${fileData.size} bytes (max: ${maxSize * MB_IN_BYTES} bytes)`);
      return false;
    }
    
    // Validate video duration if applicable
    if (mediaType === 'video' && fileData.duration && fileData.duration > MAX_VIDEO_DURATION * 1000) {
      console.error(`Video too long: ${fileData.duration}ms (max: ${MAX_VIDEO_DURATION * 1000}ms)`);
      return false;
    }
    
    return true;
  }
/**
   * Pick an image from library or camera
   * 
   * @param {Object} options - Picker options
   * @returns {Promise<Object>} Selected media information
   */
  pickImage = async (options = {}) => {
    try {
      const defaultOptions = {
        mediaType: 'photo',
        cropping: false,
        includeBase64: false,
        compressImageQuality: 0.8,
        compressImageMaxWidth: MAX_IMAGE_WIDTH,
        compressImageMaxHeight: MAX_IMAGE_HEIGHT,
        includeExif: true,
        useFrontCamera: false,
        multiple: false,
        maxFiles: 1,
      };
      
      const pickerOptions = { ...defaultOptions, ...options };
      
      let result;
      
      if (options.fromCamera) {
        result = await ImagePicker.openCamera(pickerOptions);
      } else {
        result = await ImagePicker.openPicker(pickerOptions);
      }
      
      // Handle multiple selection
      if (pickerOptions.multiple && Array.isArray(result)) {
        return Promise.all(result.map(image => this.processImage(image)));
      }
      
      // Validate and process single image
      if (!this.validateFile(result, 'photo')) {
        throw new Error('Invalid image file');
      }
      
      // Process single image
      return this.processImage(result);
      
    } catch (error) {
      // Handle permission errors and cancellations gracefully
      if (error.code === 'E_PICKER_CANCELLED') {
        return null; // User cancelled the picker
      }
      
      if (error.code === 'E_NO_LIBRARY_PERMISSION' || error.code === 'E_NO_CAMERA_PERMISSION') {
        Alert.alert(
          'Permission Required',
          'Please grant the required permission to access media',
          [{ text: 'OK' }]
        );
        return null;
      }
      
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      return null;
    }
  };
  
  /**
   * Pick a video from library or camera
   * 
   * @param {Object} options - Picker options
   * @returns {Promise<Object>} Selected video information
   */
  pickVideo = async (options = {}) => {
    try {
      const defaultOptions = {
        mediaType: 'video',
        compressVideoPreset: 'MediumQuality',
        includeExif: true,
        useFrontCamera: false,
      };
      
      const pickerOptions = { ...defaultOptions, ...options };
      
      let result;
      
      if (options.fromCamera) {
        result = await ImagePicker.openCamera(pickerOptions);
      } else {
        result = await ImagePicker.openPicker(pickerOptions);
      }
      
      // Verify if it's actually a video
      if (!result.mime?.startsWith('video/')) {
        throw new Error('Selected file is not a video');
      }
      
      // Validate file
      if (!this.validateFile(result, 'video')) {
        throw new Error('Invalid video file');
      }
      
      // Process video
      return this.processVideo(result);
      
    } catch (error) {
      // Handle permission errors and cancellations gracefully
      if (error.code === 'E_PICKER_CANCELLED') {
        return null; // User cancelled the picker
      }
      
      if (error.code === 'E_NO_LIBRARY_PERMISSION' || error.code === 'E_NO_CAMERA_PERMISSION') {
        Alert.alert(
          'Permission Required',
          'Please grant the required permission to access media',
          [{ text: 'OK' }]
        );
        return null;
      }
      
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
      return null;
    }
  };
  
  /**
   * Process and optimize an image
   * 
   * @param {Object} imageData - Raw image data from picker
   * @returns {Promise<Object>} Processed image info
   */
  processImage = async (imageData) => {
    try {
      // Extract file info
      const { path, mime, width, height, size } = imageData;
      
      // Validate file exists
      const fileExists = await RNFS.exists(path);
      if (!fileExists) {
        throw new Error('Image file not found');
      }
      
      // Validate mime type
      if (!VALID_IMAGE_MIME_TYPES.includes(mime)) {
        throw new Error('Invalid image format');
      }
      
      // Validate file size
      if (size > MAX_IMAGE_SIZE_MB * MB_IN_BYTES) {
        const quality = Math.min(70, (MAX_IMAGE_SIZE_MB * MB_IN_BYTES / size) * 100);
        
        // Calculate new dimensions while maintaining aspect ratio
        const aspectRatio = width / height;
        let newWidth = width;
        let newHeight = height;
        
        if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
          if (aspectRatio > 1) {
            newWidth = Math.min(width, MAX_IMAGE_WIDTH);
            newHeight = Math.round(newWidth / aspectRatio);
          } else {
            newHeight = Math.min(height, MAX_IMAGE_HEIGHT);
            newWidth = Math.round(newHeight * aspectRatio);
          }
        }
        
        // Get file extension from mime type
        const extension = mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1];
        
        // Resize and compress image
        const resizedImage = await ImageResizer.createResizedImage(
          path,
          newWidth,
          newHeight,
          extension === 'png' ? 'PNG' : 'JPEG',
          Math.round(quality),
          0,
          null
        );
        
        // Verify the resized file exists
        const resizedFileExists = await RNFS.exists(resizedImage.uri);
        if (!resizedFileExists) {
          throw new Error('Resized image file not found');
        }
        
        // Get file info
        const fileInfo = await RNFS.stat(resizedImage.uri);
        
        return {
          uri: resizedImage.uri,
          width: resizedImage.width,
          height: resizedImage.height,
          mime: mime,
          size: fileInfo.size,
          filename: resizedImage.name,
          path: resizedImage.uri,
        };
      }
      
      // If no optimization needed, return original
      return {
        uri: path,
        width,
        height,
        mime,
        size,
        filename: path.split('/').pop(),
        path,
      };
      
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  };
  
  /**
   * Process and optimize a video
   * 
   * @param {Object} videoData - Raw video data from picker
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Processed video info
   */
  processVideo = async (videoData, progressCallback) => {
    try {
      const { path, mime, size, duration } = videoData;
      
      // Validate file exists
      const fileExists = await RNFS.exists(path);
      if (!fileExists) {
        throw new Error('Video file not found');
      }
      
      // Validate mime type
      if (!VALID_VIDEO_MIME_TYPES.includes(mime)) {
        throw new Error('Invalid video format');
      }
      
      // Create output path
      const outputPath = `${RNFS.CachesDirectoryPath}/processed_video_${uuidv4()}.mp4`;
      
      // Check if video needs processing
      const needsProcessing = size > MAX_VIDEO_SIZE_MB * MB_IN_BYTES || duration > MAX_VIDEO_DURATION * 1000;
      
      if (needsProcessing) {
        // Set up video transcoding options
        const durationToUse = Math.min(duration, MAX_VIDEO_DURATION * 1000);
        const targetBitrate = Math.min(2000000, Math.floor((MAX_VIDEO_SIZE_MB * 8 * MB_IN_BYTES) / durationToUse));
        
        // Create FFmpeg command for transcoding
        let command = `-i "${path}" -c:v libx264 -preset medium -b:v ${targetBitrate} -maxrate ${targetBitrate * 1.5} -bufsize ${targetBitrate * 3}`;
        
        // Trim if needed
        if (duration > MAX_VIDEO_DURATION * 1000) {
          command += ` -t ${MAX_VIDEO_DURATION}`;
        }
        
        // Audio settings
        command += ' -c:a aac -b:a 128k';
        
        // Output file
        command += ` -f mp4 -movflags +faststart "${outputPath}"`;
        
        // Execute FFmpeg command
        const session = await FFmpegKit.execute(command);
        const returnCode = await session.getReturnCode();
        
        if (returnCode.isValueError()) {
          const logs = await session.getLogs();
          console.error('FFmpeg error:', logs);
          throw new Error('Failed to process video');
        }
        
        // Verify the processed file exists
        const processedFileExists = await RNFS.exists(outputPath);
        if (!processedFileExists) {
          throw new Error('Processed video file not found');
        }
        
        // Get processed video info
        const fileInfo = await RNFS.stat(outputPath);
        
        return {
          uri: outputPath,
          mime: 'video/mp4',
          size: fileInfo.size,
          duration: durationToUse,
          filename: outputPath.split('/').pop(),
          path: outputPath,
        };
      }
      
      // If no processing needed, return original
      return {
        uri: path,
        mime,
        size,
        duration,
        filename: path.split('/').pop(),
        path,
      };
      
    } catch (error) {
      console.error('Error processing video:', error);
      throw error;
    }
  };
  
  /**
   * Upload media to Firebase Storage
   * 
   * @param {Object} mediaData - Media data to upload
   * @param {string} mediaType - Type of media ('image' or 'video')
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<string>} Download URL of uploaded media
   */
  uploadMedia = async (mediaData, mediaType = 'image', progressCallback) => {
    try {
      if (!mediaData || !mediaData.uri) {
        throw new Error('Invalid media data');
      }
      
      // Validate file exists
      const fileExists = await RNFS.exists(mediaData.uri);
      if (!fileExists) {
        throw new Error('Media file not found');
      }
      
      // Check if we're online
      const isOnline = await isDeviceOnline();
      if (!isOnline) {
        // Queue for later upload
        return this.queueUpload(mediaData, mediaType, progressCallback);
      }
      
      const userId = auth().currentUser?.uid || 'anonymous';
      
      // Generate a unique filename with proper extension
      const filename = mediaData.filename || mediaData.uri.split('/').pop();
      const extension = filename.split('.').pop().toLowerCase();
      const validExtensions = mediaType === 'image' ? SUPPORTED_IMAGE_FORMATS : SUPPORTED_VIDEO_FORMATS;
      
      if (!validExtensions.includes(extension)) {
        throw new Error(`Unsupported file format: ${extension}`);
      }
      
      const uniqueFilename = `${userId}_${Date.now()}_${uuidv4()}.${extension}`;
      
      // Define storage path based on media type
      const storagePath = `${mediaType === 'image' ? 'images' : 'videos'}/${uniqueFilename}`;
      
      // Upload the file
      return await this.uploadMediaInternal(mediaData.uri, storagePath, mediaType, progressCallback);
      
    } catch (error) {
      console.error(`Error uploading ${mediaType}:`, error);
      throw error;
    }
  };

  /**
   * Queue a media upload for when connection is restored
   * 
   * @param {Object} mediaData - Media data to upload
   * @param {string} mediaType - Type of media ('image' or 'video')
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<string>} Temporary URL for UI display
   */
  queueUpload = async (mediaData, mediaType, progressCallback) => {
    try {
      const userId = auth().currentUser?.uid || 'anonymous';
      
      // Generate a path where this would be uploaded
      const filename = mediaData.filename || mediaData.uri.split('/').pop();
      const extension = filename.split('.').pop().toLowerCase();
      const uniqueFilename = `${userId}_${Date.now()}_${uuidv4()}.${extension}`;
      const storagePath = `${mediaType === 'image' ? 'images' : 'videos'}/${uniqueFilename}`;
      
      // Create a unique ID for this upload
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add to queue with callbacks
      const queueItem = {
        id: uploadId,
        uri: mediaData.uri,
        path: storagePath,
        mediaType,
        attempts: 0,
        timestamp: Date.now(),
        onProgress: progressCallback,
        onSuccess: null,
        onError: null
      };
      
      this.uploadQueue.push(queueItem);
      await this.savePendingUploads();
      
      // Create a promise that will resolve when the upload completes
      return new Promise((resolve, reject) => {
        // Find the queue item and add callbacks
        const index = this.uploadQueue.findIndex(item => item.id === uploadId);
        if (index !== -1) {
          this.uploadQueue[index].onSuccess = resolve;
          this.uploadQueue[index].onError = reject;
          this.savePendingUploads();
        } else {
          reject(new Error('Failed to queue upload'));
        }
        
        // Start processing the queue if we're not already
        this.processUploadQueue();
      });
    } catch (error) {
      console.error('Error queuing upload:', error);
      throw error;
    }
  };

  /**
   * Internal method to upload media to Firebase Storage
   * 
   * @param {string} uri - Local file URI
   * @param {string} storagePath - Firebase Storage path
   * @param {string} mediaType - Type of media ('image' or 'video')
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<string>} Download URL
   */
  uploadMediaInternal = async (uri, storagePath, mediaType, progressCallback) => {
    try {
      // Verify file exists
      const fileExists = await RNFS.exists(uri);
      if (!fileExists) {
        throw new Error('File not found for upload');
      }
      
      const storageRef = storage().ref(storagePath);
      
      // Use a unique ID to track this upload
      const uploadId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create upload task
      const task = storageRef.putFile(uri);
      
      // Monitor progress if callback provided
      if (progressCallback) {
        task.on('state_changed', snapshot => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          progressCallback(progress);
        });
      }
      
      // Track this upload
      this.pendingUploads.set(uploadId, task);
      
      // Wait for upload to complete
      await task;
      
      // Remove from pending uploads
      this.pendingUploads.delete(uploadId);
      
      // Get download URL
      const url = await withRetry(() => storageRef.getDownloadURL());
      
      return url;
    } catch (error) {
      console.error(`Error uploading media:`, error);
      throw error;
    }
  };
  
  /**
   * Cancel a specific upload in progress
   * 
   * @param {string} uploadId - Upload ID to cancel
   * @returns {boolean} Whether the upload was cancelled
   */
  cancelUpload = (uploadId) => {
    try {
      if (this.pendingUploads.has(uploadId)) {
        const task = this.pendingUploads.get(uploadId);
        task.cancel();
        this.pendingUploads.delete(uploadId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error cancelling upload:', error);
      return false;
    }
  };
  
  /**
   * Cancel all pending uploads
   */
  cancelAllUploads = () => {
    try {
      for (const [uploadId, task] of this.pendingUploads.entries()) {
        try {
          task.cancel();
        } catch (error) {
          console.error(`Error cancelling upload ${uploadId}:`, error);
        }
      }
      this.pendingUploads.clear();
    } catch (error) {
      console.error('Error cancelling all uploads:', error);
    }
  };
  
  /**
   * Check if a file format is supported
   * 
   * @param {string} filename - Filename with extension
   * @param {string} mediaType - Type of media ('image' or 'video')
   * @returns {boolean} Whether the format is supported
   */
  isFormatSupported = (filename, mediaType = 'image') => {
    try {
      if (!filename) return false;
      
      const extension = filename.split('.').pop().toLowerCase();
      
      if (mediaType === 'image') {
        return SUPPORTED_IMAGE_FORMATS.includes(extension);
      } else if (mediaType === 'video') {
        return SUPPORTED_VIDEO_FORMATS.includes(extension);
      }
      
      return false;
    } catch (error) {
      console.error('Error checking format support:', error);
      return false;
    }
  };
  
  /**
   * Create a thumbnail from a video
   * 
   * @param {string} videoUri - URI of the video
   * @returns {Promise<string>} URI of the generated thumbnail
   */
  createVideoThumbnail = async (videoUri) => {
    try {
      // Verify file exists
      const fileExists = await RNFS.exists(videoUri);
      if (!fileExists) {
        throw new Error('Video file not found');
      }
      
      const outputPath = `${RNFS.CachesDirectoryPath}/thumbnail_${uuidv4()}.jpg`;
      
      // Use FFmpeg to extract frame at 1 second
      const command = `-i "${videoUri}" -ss 00:00:01.000 -vframes 1 "${outputPath}"`;
      const session = await FFmpegKit.execute(command);
      const returnCode = await session.getReturnCode();
      
      if (returnCode.isValueError()) {
        const logs = await session.getLogs();
        console.error('FFmpeg error creating thumbnail:', logs);
        throw new Error('Failed to create video thumbnail');
      }
      
      // Verify the thumbnail file exists
      const thumbnailExists = await RNFS.exists(outputPath);
      if (!thumbnailExists) {
        throw new Error('Thumbnail file not found');
      }
      
      return outputPath;
    } catch (error) {
      console.error('Error creating video thumbnail:', error);
      throw error;
    }
  };
  
  /**
   * Delete a file from Firebase Storage
   * 
   * @param {string} downloadUrl - Download URL of the file to delete
   * @returns {Promise<boolean>} Whether the file was deleted
   */
  deleteMedia = async (downloadUrl) => {
    try {
      if (!downloadUrl) {
        throw new Error('Invalid download URL');
      }
      
      // Check if we're online
      const isOnline = await isDeviceOnline();
      if (!isOnline) {
        throw new Error('Cannot delete media while offline');
      }
      
      // Get reference from URL
      const fileRef = storage().refFromURL(downloadUrl);
      
      // Delete file
      await withRetry(() => fileRef.delete());
      
      return true;
    } catch (error) {
      console.error('Error deleting media:', error);
      throw error;
    }
  };
  
  /**
   * Clean up temporary files
   * 
   * @returns {Promise<void>}
   */
  cleanupTempFiles = async () => {
    try {
      // Get files in cache directory
      const files = await RNFS.readDir(RNFS.CachesDirectoryPath);
      
      // Filter for temp media files
      const mediaFiles = files.filter(file => {
        const filename = file.name.toLowerCase();
        return (
          (filename.startsWith('processed_video_') || filename.startsWith('thumbnail_')) &&
          file.isFile()
        );
      });
      
      // Calculate file age and delete old files
      const now = Date.now();
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      
      for (const file of mediaFiles) {
        try {
          const stats = await RNFS.stat(file.path);
          const fileAge = now - stats.mtime.getTime();
          
          // Delete files older than 1 day
          if (fileAge > ONE_DAY_MS) {
            await RNFS.unlink(file.path);
          }
        } catch (error) {
          console.error(`Error processing file ${file.path}:`, error);
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  };
}

// Create and export singleton instance
const mediaService = new MediaService();

// Initialize the service
mediaService.initialize().catch(error => {
  console.error('Failed to initialize media service:', error);
});

// Clean up temp files periodically
setInterval(() => {
  mediaService.cleanupTempFiles().catch(error => {
    console.error('Failed to clean up temp files:', error);
  });
}, 12 * 60 * 60 * 1000); // Every 12 hours

export default mediaService;// src/services/MediaService.js
// Enhanced service for handling media uploads across platforms with better security and reliability

import { Platform, Alert } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';
import { FFmpegKit } from 'ffmpeg-kit-react-native';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import { withRetry } from './RetryService';
import { isDeviceOnline } from './NetworkService';

// Constants for media
const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 1920;
const IMAGE_QUALITY = 80;
const MAX_IMAGE_SIZE_MB = 10;
const MAX_VIDEO_SIZE_MB = 100;
const MAX_VIDEO_DURATION = 180; // 3 minutes
const MB_IN_BYTES = 1024 * 1024;

// Supported file formats
const SUPPORTED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'webp'];
const SUPPORTED_VIDEO_FORMATS = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp', 'flv', 'wmv'];

// Mime type validation
const VALID_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/webp'
];

const VALID_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/3gpp',
  'video/x-flv',
  'video/x-ms-wmv'
];

class MediaService {
  constructor() {
    this.pendingUploads = new Map();
    this.uploadQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Initialize the media service
   */
  async initialize() {
    try {
      // Load pending uploads from AsyncStorage
      this.loadPendingUploads();
      
      // Process any pending uploads
      this.processUploadQueue();
    } catch (error) {
      console.error('Error initializing MediaService:', error);
    }
  }

  /**
   * Load pending uploads from storage
   */
  async loadPendingUploads() {
    try {
      const pendingUploadsJson = await AsyncStorage.getItem('pendingUploads');
      if (pendingUploadsJson) {
        this.uploadQueue = JSON.parse(pendingUploadsJson);
      }
    } catch (error) {
      console.error('Error loading pending uploads:', error);
      this.uploadQueue = [];
    }
  }

  /**
   * Save pending uploads to storage
   */
  async savePendingUploads() {
    try {
      await AsyncStorage.setItem('pendingUploads', JSON.stringify(this.uploadQueue));
    } catch (error) {
      console.error('Error saving pending uploads:', error);
    }
  }

  /**
   * Process the upload queue
   */
  async processUploadQueue() {
    if (this.isProcessingQueue || this.uploadQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    try {
      // Check if online
      const isOnline = await isDeviceOnline();
      if (!isOnline) {
        this.isProcessingQueue = false;
        return;
      }
      
      // Process each item in the queue
      const queue = [...this.uploadQueue];
      this.uploadQueue = [];
      
      for (const item of queue) {
        try {
          // Verify the file still exists
          const fileExists = await RNFS.exists(item.uri);
          if (!fileExists) {
            console.warn(`File not found for pending upload: ${item.uri}`);
            continue;
          }
          
          // Upload the file
          const url = await this.uploadMediaInternal(
            item.uri, 
            item.path, 
            item.mediaType, 
            (progress) => {
              if (item.onProgress) {
                item.onProgress(progress);
              }
            }
          );
          
          // Call success callback if defined
          if (item.onSuccess && typeof item.onSuccess === 'function') {
            item.onSuccess(url);
          }
        } catch (error) {
          console.error('Error processing queued upload:', error);
          
          // If retryable and under max attempts, re-queue
          if (item.attempts < 3) {
            this.uploadQueue.push({
              ...item,
              attempts: (item.attempts || 0) + 1
            });
          } else if (item.onError && typeof item.onError === 'function') {
            item.onError(error);
          }
        }
      }
      
      // Save any re-queued items
      if (this.uploadQueue.length > 0) {
        await this.savePendingUploads();
      }
    } catch (error) {
      console.error('Error processing upload queue:', error);
    } finally {
      this.isProcessingQueue = false;
      
      // If there are still items in the queue, try again later
      if (this.uploadQueue.length > 0) {
        setTimeout(() => this.processUploadQueue(), 60000); // Try again in 1 minute
      }
    }
  }

  /**
   * Validate a file based on its mime type and size
   * 
   * @param {Object} fileData - File data to validate
   * @param {string} mediaType - Type of media ('photo' or 'video')
   * @returns {boolean} Whether the file is valid
   */
  validateFile(fileData, mediaType) {
    if (!fileData) return false;
    
    // Validate mime type
    const validMimeTypes = mediaType === 'photo' ? VALID_IMAGE_MIME_TYPES : VALID_VIDEO_MIME_TYPES;
    if (!validMimeTypes.includes(fileData.mime)) {
      console.error(`Invalid mime type: ${fileData.mime}`);
      return false;
    }
    
    // Validate file size
    const maxSize = mediaType === 'photo' ? MAX_IMAGE_SIZE_MB : MAX_VIDEO_SIZE_MB;
    if (fileData.size > maxSize * MB_IN_BYTES) {
      console.error(`File too large: ${fileData.size} bytes (max: ${maxSize * MB_IN_BYTES} bytes)`);
      return false;
    }
    
    // Validate video duration if applicable
    if (mediaType === 'video' && fileData.duration && fileData.duration > MAX_VIDEO_DURATION * 1000) {
      console.error(`Video too long: ${fileData.duration}ms (max: ${MAX_VIDEO_DURATION * 1000}ms)`);
      return false;
    }
    
    return true;
  }

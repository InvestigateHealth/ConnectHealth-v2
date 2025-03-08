// src/services/MediaService.js
// Enhanced service for handling media uploads across platforms

import { Platform, Alert } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';
import { FFmpegKit } from 'ffmpeg-kit-react-native';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { v4 as uuidv4 } from 'uuid';

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

class MediaService {
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
        await FFmpegKit.execute(command);
        
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
      const { uri, filename } = mediaData;
      const userId = auth().currentUser?.uid || 'anonymous';
      
      // Generate a unique filename
      const extension = filename.split('.').pop();
      const uniqueFilename = `${userId}_${Date.now()}.${extension}`;
      
      // Define storage path based on media type
      const storagePath = `${mediaType === 'image' ? 'images' : 'videos'}/${uniqueFilename}`;
      const storageRef = storage().ref(storagePath);
      
      // Upload file
      const task = storageRef.putFile(uri);
      
      // Handle progress updates
      if (progressCallback) {
        task.on('state_changed', snapshot => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          progressCallback(progress);
        });
      }
      
      // Wait for upload to complete
      await task;
      
      // Get download URL
      const downloadUrl = await storageRef.getDownloadURL();
      
      return downloadUrl;
      
    } catch (error) {
      console.error(`Error uploading ${mediaType}:`, error);
      throw error;
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
    const extension = filename.split('.').pop().toLowerCase();
    
    if (mediaType === 'image') {
      return SUPPORTED_IMAGE_FORMATS.includes(extension);
    } else if (mediaType === 'video') {
      return SUPPORTED_VIDEO_FORMATS.includes(extension);
    }
    
    return false;
  };
  
  /**
   * Create a thumbnail from a video
   * 
   * @param {string} videoUri - URI of the video
   * @returns {Promise<string>} URI of the generated thumbnail
   */
  createVideoThumbnail = async (videoUri) => {
    try {
      const outputPath = `${RNFS.CachesDirectoryPath}/thumbnail_${uuidv4()}.jpg`;
      
      // Use FFmpeg to extract frame at 1 second
      const command = `-i "${videoUri}" -ss 00:00:01.000 -vframes 1 "${outputPath}"`;
      await FFmpegKit.execute(command);
      
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
   * @returns {Promise<void>}
   */
  deleteMedia = async (downloadUrl) => {
    try {
      // Get reference from URL
      const fileRef = storage().refFromURL(downloadUrl);
      
      // Delete file
      await fileRef.delete();
    } catch (error) {
      console.error('Error deleting media:', error);
      throw error;
    }
  };
}

export default new MediaService();

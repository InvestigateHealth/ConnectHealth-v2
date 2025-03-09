// src/utils/mediaProcessing.js
// Comprehensive utilities for image and video processing with proper error handling

import { Platform, Dimensions } from 'react-native';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import { createThumbnail } from 'react-native-create-thumbnail';
import ImageCropPicker from 'react-native-image-crop-picker';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import uuid from 'react-native-uuid';
import { validateImageType, validateVideoType, validateFileSize } from './validationUtils';

// Reasonable defaults for image sizes
const IMAGE_SIZES = {
  thumbnail: { width: 320, height: 320 },
  medium: { width: 800, height: 800 },
  large: { width: 1600, height: 1600 },
  profile: { width: 400, height: 400 },
  avatar: { width: 150, height: 150 },
  cover: { width: 1200, height: 400 },
};

// Improved temp directory handling based on platform
const TEMP_DIR = Platform.OS === 'ios'
  ? `${RNFS.TemporaryDirectoryPath}/mediaProcessing`
  : `${RNFS.CachesDirectoryPath}/mediaProcessing`;

// Maximum time to keep temporary files (1 hour)
const TEMP_FILE_TTL = 60 * 60 * 1000;

// Maximum file sizes in MB
const MAX_FILE_SIZES = {
  image: 15,        // 15MB for images
  video: 100,       // 100MB for videos
  audio: 30,        // 30MB for audio
  document: 20,     // 20MB for documents
  profileImage: 8,  // 8MB for profile images
  avatar: 3         // 3MB for avatars
};

// Video processing settings
const VIDEO_SETTINGS = {
  maxDuration: 300,  // 5 minutes in seconds
  compressionQuality: 'medium',
  maxResolution: 1080, // 1080p
  maxBitrate: 2500000, // 2.5 Mbps
  maxFrameRate: 30
};

// Tracking active processing operations
const activeOperations = new Map();
let isInitialized = false;

/**
 * Initialize the media processing module
 * @returns {Promise<void>}
 */
const initialize = async () => {
  if (isInitialized) return;
  
  try {
    await ensureTempDir();
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize media processing module:', error);
    // Still mark as initialized to avoid repeated failed attempts
    isInitialized = true;
  }
};

/**
 * Ensure temp directory exists and clean up old files
 * @returns {Promise<void>}
 */
const ensureTempDir = async () => {
  try {
    const exists = await RNFS.exists(TEMP_DIR);
    if (!exists) {
      await RNFS.mkdir(TEMP_DIR);
    }
    
    // Clean up old temp files
    await cleanTempDirectory();
  } catch (error) {
    console.error('Error ensuring temp directory:', error);
    // Fall back to default temp directory if creation fails
    throw new Error(`Failed to create temporary directory: ${error.message}`);
  }
};

/**
 * Clean up old temporary files
 * @returns {Promise<void>}
 */
const cleanTempDirectory = async () => {
  try {
    // Don't attempt cleanup if directory doesn't exist
    const exists = await RNFS.exists(TEMP_DIR);
    if (!exists) return;
    
    const now = Date.now();
    const files = await RNFS.readDir(TEMP_DIR);
    
    // Process files in chunks to avoid blocking UI
    const chunkSize = 5;
    
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (file) => {
        try {
          // Skip directories
          if (file.isDirectory()) {
            return;
          }
          
          // Check file age
          const stats = await RNFS.stat(file.path);
          const fileAge = now - (stats.mtime || stats.ctime);
          
          // Delete files older than TTL
          if (fileAge > TEMP_FILE_TTL) {
            // Ensure the file isn't being used in an active operation
            if (!activeOperations.has(file.path)) {
              await RNFS.unlink(file.path);
            }
          }
        } catch (fileError) {
          console.warn(`Error processing temp file ${file.path}:`, fileError);
          // Continue with other files
        }
      }));
      
      // Small pause between chunks to avoid UI blocking
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } catch (error) {
    console.error('Error cleaning temp directory:', error);
    throw new Error(`Failed to clean temporary directory: ${error.message}`);
  }
};

/**
 * Generate a unique filename for temporary files
 * @param {string} prefix - File prefix
 * @param {string} extension - File extension without dot
 * @returns {string} Unique filepath
 */
const generateTempFilePath = (prefix, extension) => {
  const uniqueId = uuid.v4();
  return `${TEMP_DIR}/${prefix}_${uniqueId}.${extension}`;
};

/**
 * Register an active operation with a file
 * @param {string} filePath - Path to the file being processed
 * @param {string} operationType - Type of operation
 * @returns {function} Function to call when operation is complete
 */
const registerActiveOperation = (filePath, operationType) => {
  const operationId = `${operationType}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  activeOperations.set(filePath, operationId);
  
  // Return a function to mark the operation as complete
  return () => {
    if (activeOperations.get(filePath) === operationId) {
      activeOperations.delete(filePath);
    }
  };
};

/**
 * Process an image with resizing, format conversion, and optimization
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processed image info
 */
const processImage = async (options) => {
  const {
    uri,
    width = IMAGE_SIZES.medium.width,
    height = IMAGE_SIZES.medium.height,
    quality = 85,
    format = 'JPEG',
    rotation = 0,
    outputFormat = 'jpg',
    resizeMode = 'contain',
    keepExif = false,
    cropSettings = null,
    maxFileSize = MAX_FILE_SIZES.image
  } = options;
  
  if (!uri) {
    throw new Error('Image URI is required');
  }

  try {
    await initialize();
    
    // Validate image type
    const mimeType = uri.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || 'jpeg';
    const imageTypeValidation = validateImageType(`image/${mimeType}`);
    if (!imageTypeValidation.isValid) {
      throw new Error(imageTypeValidation.message || 'Invalid image type');
    }
    
    // Validate file size if uri is a local file
    if (uri.startsWith('file://') || uri.startsWith('/')) {
      const fileStats = await RNFS.stat(uri.replace('file://', ''));
      const fileSizeValidation = validateFileSize(fileStats.size, maxFileSize);
      if (!fileSizeValidation.isValid) {
        throw new Error(fileSizeValidation.message || 'File too large');
      }
    }
    
    // Generate output path
    const outputPath = generateTempFilePath('processed_image', outputFormat);
    const completeOperation = registerActiveOperation(outputPath, 'image_processing');
    
    // Determine resize mode
    let resizeModeValue;
    switch (resizeMode) {
      case 'contain':
        resizeModeValue = ImageResizer.RESIZE_MODE.CONTAIN;
        break;
      case 'cover':
        resizeModeValue = ImageResizer.RESIZE_MODE.COVER;
        break;
      case 'stretch':
        resizeModeValue = ImageResizer.RESIZE_MODE.STRETCH;
        break;
      default:
        resizeModeValue = ImageResizer.RESIZE_MODE.CONTAIN;
    }
    
    // Apply custom crop if specified
    let sourceUri = uri;
    if (cropSettings) {
      try {
        const { x, y, cropWidth, cropHeight } = cropSettings;
        const croppedImage = await ImageCropPicker.openCropper({
          path: uri.replace('file://', ''),
          cropRect: { x, y, width: cropWidth, height: cropHeight },
          width: cropWidth,
          height: cropHeight,
          includeBase64: false,
          compressImageQuality: quality / 100,
          cropping: true
        });
        
        sourceUri = croppedImage.path;
      } catch (cropError) {
        console.warn('Error cropping image, proceeding with original:', cropError);
        // Proceed with original image if cropping fails
      }
    }
    
    // Process the image
    const result = await ImageResizer.createResizedImage(
      sourceUri,
      width,
      height,
      format,
      quality,
      rotation,
      outputPath,
      keepExif,
      resizeModeValue
    );
    
    // Get file size
    const stats = await RNFS.stat(result.path);
    
    // Check if the result is still too large and compress further if needed
    if (stats.size > maxFileSize * 1024 * 1024) {
      // Reduce quality for further compression
      const reducedQuality = Math.max(60, quality - 15);
      
      // Try to compress the image again
      const recompressedPath = generateTempFilePath('recompressed_image', outputFormat);
      
      const recompressedResult = await ImageResizer.createResizedImage(
        result.path,
        width,
        height,
        format,
        reducedQuality,
        rotation,
        recompressedPath,
        keepExif,
        resizeModeValue
      );
      
      // Clean up the original processed image
      try {
        await RNFS.unlink(result.path);
      } catch (unlinkError) {
        console.warn('Error deleting temporary file:', unlinkError);
      }
      
      const recompressedStats = await RNFS.stat(recompressedResult.path);
      
      completeOperation();
      return {
        uri: recompressedResult.uri || `file://${recompressedResult.path}`,
        path: recompressedResult.path,
        name: recompressedResult.name,
        width: recompressedResult.width,
        height: recompressedResult.height,
        size: recompressedStats.size,
        type: `image/${outputFormat.toLowerCase()}`
      };
    }
    
    completeOperation();
    return {
      uri: result.uri || `file://${result.path}`,
      path: result.path,
      name: result.name,
      width: result.width,
      height: result.height,
      size: stats.size,
      type: `image/${outputFormat.toLowerCase()}`
    };
  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error(`Image processing failed: ${error.message}`);
  }
};

/**
 * Create thumbnails for images at different sizes
 * @param {Object} options - Thumbnail options
 * @returns {Promise<Object>} Thumbnails at different sizes
 */
const createImageThumbnails = async (options) => {
  const {
    uri,
    sizes = ['thumbnail', 'medium'],
    quality = 80,
    format = 'JPEG',
    outputFormat = 'jpg'
  } = options;
  
  if (!uri) {
    throw new Error('Image URI is required');
  }

  try {
    await initialize();
    
    // Process each requested size in parallel
    const thumbnailPromises = sizes.map(async (sizeKey) => {
      // Get dimensions for this size
      const sizeConfig = IMAGE_SIZES[sizeKey] || IMAGE_SIZES.thumbnail;
      
      // Process the image at this size
      const result = await processImage({
        uri,
        width: sizeConfig.width,
        height: sizeConfig.height,
        quality,
        format,
        outputFormat,
        resizeMode: 'cover'
      });
      
      return { size: sizeKey, ...result };
    });
    
    // Wait for all thumbnails to complete
    const thumbnails = await Promise.all(thumbnailPromises);
    
    // Convert to object with size keys
    const result = {};
    thumbnails.forEach(thumbnail => {
      result[thumbnail.size] = {
        uri: thumbnail.uri,
        path: thumbnail.path,
        width: thumbnail.width,
        height: thumbnail.height,
        size: thumbnail.size,
        type: thumbnail.type
      };
    });
    
    return result;
  } catch (error) {
    console.error('Error creating image thumbnails:', error);
    throw new Error(`Thumbnail creation failed: ${error.message}`);
  }
};

/**
 * Process a video with compression, format conversion, and trimming
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processed video info
 */
const processVideo = async (options) => {
  const {
    uri,
    quality = 'medium', // 'low', 'medium', 'high'
    maxDuration = VIDEO_SETTINGS.maxDuration,
    maxResolution = VIDEO_SETTINGS.maxResolution,
    maxBitrate = VIDEO_SETTINGS.maxBitrate,
    maxFrameRate = VIDEO_SETTINGS.maxFrameRate,
    outputFormat = 'mp4',
    startTime = 0,
    endTime = null,
    mute = false,
    maxFileSize = MAX_FILE_SIZES.video
  } = options;
  
  if (!uri) {
    throw new Error('Video URI is required');
  }

  try {
    await initialize();
    
    // Validate video type from extension
    const extension = uri.split('.').pop().toLowerCase();
    const videoTypeValidation = validateVideoType(`video/${extension}`);
    if (!videoTypeValidation.isValid) {
      throw new Error(videoTypeValidation.message || 'Invalid video type');
    }
    
    // Validate file size if uri is a local file
    if (uri.startsWith('file://') || uri.startsWith('/')) {
      const fileStats = await RNFS.stat(uri.replace('file://', ''));
      const fileSizeValidation = validateFileSize(fileStats.size, maxFileSize);
      if (!fileSizeValidation.isValid) {
        throw new Error(fileSizeValidation.message || 'File too large');
      }
    }
    
    // Generate output path
    const outputPath = generateTempFilePath('processed_video', outputFormat);
    const completeOperation = registerActiveOperation(outputPath, 'video_processing');
    
    // Create video thumbnail before processing
    const thumbnailResult = await createVideoThumbnail({ videoUri: uri });
    
    // Map quality setting to bitrate and resolution
    let targetBitrate, targetResolution, targetFrameRate;
    switch (quality) {
      case 'low':
        targetBitrate = Math.min(maxBitrate, 1000000); // 1 Mbps
        targetResolution = Math.min(maxResolution, 480);
        targetFrameRate = Math.min(maxFrameRate, 24);
        break;
      case 'high':
        targetBitrate = Math.min(maxBitrate, 4000000); // 4 Mbps
        targetResolution = Math.min(maxResolution, 1080);
        targetFrameRate = Math.min(maxFrameRate, 30);
        break;
      case 'medium':
      default:
        targetBitrate = Math.min(maxBitrate, 2000000); // 2 Mbps
        targetResolution = Math.min(maxResolution, 720);
        targetFrameRate = Math.min(maxFrameRate, 30);
    }
    
    // Build FFmpeg command
    let command = `-i "${uri}" -c:v libx264 -preset medium -crf 23 -maxrate ${targetBitrate} -bufsize ${targetBitrate * 2}`;
    
    // Add resolution scaling if needed
    command += ` -vf "scale='min(${targetResolution},iw)':'min(${targetResolution},ih)':force_original_aspect_ratio=decrease"`;
    
    // Add frame rate control
    command += ` -r ${targetFrameRate}`;
    
    // Add trim settings if needed
    if (startTime > 0 || endTime !== null) {
      command = `-ss ${startTime} ` + command;
      if (endTime !== null) {
        command += ` -to ${endTime}`;
      }
    }
    
    // Add max duration limit if needed and not already trimmed
    if (maxDuration > 0 && endTime === null) {
      command += ` -t ${maxDuration}`;
    }
    
    // Handle audio settings
    if (mute) {
      command += ' -an';
    } else {
      command += ' -c:a aac -b:a 128k';
    }
    
    // Finalize command with output path
    command += ` -y "${outputPath}"`;
    
    // Execute FFmpeg command
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();
    
    if (ReturnCode.isSuccess(returnCode)) {
      // Get file stats
      const stats = await RNFS.stat(outputPath);
      
      completeOperation();
      return {
        uri: `file://${outputPath}`,
        path: outputPath,
        size: stats.size,
        duration: endTime ? (endTime - startTime) * 1000 : null, // Convert to milliseconds
        thumbnail: thumbnailResult,
        type: `video/${outputFormat}`
      };
    } else {
      const logs = await session.getLogs();
      console.error('FFmpeg processing failed:', logs);
      throw new Error('Video processing failed. Check logs for details.');
    }
  } catch (error) {
    console.error('Video processing error:', error);
    throw new Error(`Video processing failed: ${error.message}`);
  }
};

/**
 * Create a thumbnail from a video
 * @param {Object} options - Thumbnail options
 * @returns {Promise<Object>} Thumbnail info
 */
const createVideoThumbnail = async (options) => {
  const {
    videoUri,
    quality = 85,
    timeStamp = 1000, // Default to 1 second
    width = IMAGE_SIZES.thumbnail.width,
    height = IMAGE_SIZES.thumbnail.height,
    format = 'jpeg'
  } = options;
  
  if (!videoUri) {
    throw new Error('Video URI is required');
  }

  try {
    await initialize();
    
    const outputPath = generateTempFilePath('video_thumbnail', format);
    const completeOperation = registerActiveOperation(outputPath, 'thumbnail_creation');
    
    // Create the thumbnail
    const result = await createThumbnail({
      url: videoUri,
      timeStamp,
      quality,
      format
    });
    
    // Resize the thumbnail if needed
    if (width !== result.width || height !== result.height) {
      const resizedThumbnail = await processImage({
        uri: result.path,
        width,
        height,
        quality,
        outputFormat: format,
        resizeMode: 'cover'
      });
      
      // Clean up original thumbnail
      try {
        await RNFS.unlink(result.path);
      } catch (unlinkError) {
        console.warn('Error deleting original thumbnail:', unlinkError);
      }
      
      completeOperation();
      return resizedThumbnail;
    }
    
    completeOperation();
    return result;
  } catch (error) {
    console.error('Error creating video thumbnail:', error);
    throw new Error(`Thumbnail creation failed: ${error.message}`);
  }
};

/**
 * Create thumbnails at different timestamps from a video
 * @param {Object} options - Thumbnail options
 * @returns {Promise<Array>} Array of thumbnails
 */
const createVideoThumbnailGrid = async (options) => {
  const {
    videoUri,
    count = 4,
    quality = 85,
    width = IMAGE_SIZES.thumbnail.width,
    height = IMAGE_SIZES.thumbnail.height,
    format = 'jpeg',
    customTimestamps = []
  } = options;
  
  if (!videoUri) {
    throw new Error('Video URI is required');
  }

  try {
    await initialize();
    
    // Get video duration if needed
    let duration = 0;
    if (customTimestamps.length === 0) {
      try {
        const info = await createThumbnail({
          url: videoUri,
          timeStamp: 0
        });
        duration = info.duration || 0;
      } catch (durationError) {
        console.warn('Error getting video duration, using defaults:', durationError);
        duration = 10000; // Default to 10 seconds
      }
    }
    
    // Generate timestamps
    const timestamps = customTimestamps.length > 0 
      ? customTimestamps
      : Array.from({ length: count }, (_, i) => {
          // Distribute evenly across the video duration, skipping the first and last 5%
          const usableDuration = duration * 0.9;
          const startOffset = duration * 0.05;
          return startOffset + (usableDuration / (count + 1)) * (i + 1);
        });
    
    // Create thumbnails for each timestamp
    const thumbnailPromises = timestamps.map(async (timeStamp, index) => {
      try {
        const result = await createVideoThumbnail({
          videoUri,
          timeStamp,
          quality,
          width,
          height,
          format
        });
        
        return {
          ...result,
          timeStamp,
          index
        };
      } catch (thumbnailError) {
        console.warn(`Error creating thumbnail at ${timeStamp}ms:`, thumbnailError);
        return null;
      }
    });
    
    // Wait for all thumbnails to complete and filter out any failures
    const thumbnails = (await Promise.all(thumbnailPromises)).filter(Boolean);
    
    return thumbnails;
  } catch (error) {
    console.error('Error creating video thumbnail grid:', error);
    throw new Error(`Thumbnail grid creation failed: ${error.message}`);
  }
};

/**
 * Extract audio from a video
 * @param {Object} options - Audio extraction options
 * @returns {Promise<Object>} Extracted audio info
 */
const extractAudioFromVideo = async (options) => {
  const {
    videoUri,
    format = 'mp3',
    bitrate = 128, // kbps
    sampleRate = 44100 // Hz
  } = options;
  
  if (!videoUri) {
    throw new Error('Video URI is required');
  }

  try {
    await initialize();
    
    // Generate output path
    const outputPath = generateTempFilePath('extracted_audio', format);
    const completeOperation = registerActiveOperation(outputPath, 'audio_extraction');
    
    // Build FFmpeg command
    let command = `-i "${videoUri}" -vn`;
    
    // Configure audio codec and quality based on format
    if (format === 'mp3') {
      command += ` -c:a libmp3lame -b:a ${bitrate}k -ar ${sampleRate}`;
    } else if (format === 'aac' || format === 'm4a') {
      command += ` -c:a aac -b:a ${bitrate}k -ar ${sampleRate}`;
    } else if (format === 'wav') {
      command += ` -c:a pcm_s16le -ar ${sampleRate}`;
    } else {
      // Default to AAC for other formats
      command += ` -c:a aac -b:a ${bitrate}k -ar ${sampleRate}`;
    }
    
    // Add output path
    command += ` -y "${outputPath}"`;
    
    // Execute FFmpeg command
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();
    
    if (ReturnCode.isSuccess(returnCode)) {
      // Get file stats
      const stats = await RNFS.stat(outputPath);
      
      completeOperation();
      return {
        uri: `file://${outputPath}`,
        path: outputPath,
        size: stats.size,
        format,
        type: `audio/${format}`
      };
    } else {
      const logs = await session.getLogs();
      console.error('Audio extraction failed:', logs);
      throw new Error('Audio extraction failed. Check logs for details.');
    }
  } catch (error) {
    console.error('Audio extraction error:', error);
    throw new Error(`Audio extraction failed: ${error.message}`);
  }
};

/**
 * Generate a blurred background from an image
 * @param {Object} options - Blur options
 * @returns {Promise<Object>} Blurred image info
 */
const generateBlurredBackground = async (options) => {
  const {
    uri,
    blurRadius = 25,
    format = 'jpg',
    quality = 80,
    width = Dimensions.get('window').width,
    height = Dimensions.get('window').height
  } = options;
  
  if (!uri) {
    throw new Error('Image URI is required');
  }

  try {
    await initialize();
    
    // Generate output path
    const outputPath = generateTempFilePath('blurred_bg', format);
    const completeOperation = registerActiveOperation(outputPath, 'blur_generation');
    
    // Build FFmpeg command for blurring
    const command = `-i "${uri}" -vf "scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=${blurRadius}:${blurRadius}" -q:v ${Math.floor(100 - quality)} -y "${outputPath}"`;
    
    // Execute FFmpeg command
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();
    
    if (ReturnCode.isSuccess(returnCode)) {
      // Get file stats
      const stats = await RNFS.stat(outputPath);
      
      completeOperation();
      return {
        uri: `file://${outputPath}`,
        path: outputPath,
        width,
        height,
        size: stats.size,
        type: `image/${format}`
      };
    } else {
      const logs = await session.getLogs();
      console.error('Blur generation failed:', logs);
      
      // Fall back to simpler image processing if FFmpeg fails
      console.log('Falling back to image resizer for blur');
      
      // Process with image resizer at low quality
      const result = await processImage({
        uri,
        width: Math.floor(width / 4), // Reduce resolution for natural blur
        height: Math.floor(height / 4),
        quality: 30, // Low quality adds more "blur"
        outputFormat: format,
        resizeMode: 'cover'
      });
      
      completeOperation();
      return result;
    }
  } catch (error) {
    console.error('Blur generation error:', error);
    throw new Error(`Blur generation failed: ${error.message}`);
  }
};

/**
 * Trim a video to specified start and end times
 * @param {Object} options - Trim options
 * @returns {Promise<Object>} Trimmed video info
 */
const trimVideo = async (options) => {
  const {
    videoUri,
    startTime = 0, // in seconds
    endTime,       // in seconds
    outputFormat = 'mp4',
    quality = 'medium'
  } = options;
  
  if (!videoUri) {
    throw new Error('Video URI is required');
  }
  
  if (endTime === undefined) {
    throw new Error('End time is required for trimming');
  }
  
  if (startTime >= endTime) {
    throw new Error('Start time must be less than end time');
  }

  // Just use the video processing function with trim options
  return processVideo({
    uri: videoUri,
    startTime,
    endTime,
    outputFormat,
    quality,
    // Don't re-encode if possible, just trim
    quality: 'high'
  });
};

/**
 * Pick image from gallery or camera with compression options
 * @param {Object} options - Image picker options
 * @returns {Promise<Object>} Selected image info
 */
const pickImage = async (options = {}) => {
  const {
    source = 'gallery', // 'gallery' or 'camera'
    mediaType = 'image',
    quality = 85,
    maxWidth = IMAGE_SIZES.large.width,
    maxHeight = IMAGE_SIZES.large.height,
    allowEditing = false,
    includeBase64 = false,
    exif = false,
    multiple = false,
    maxFiles = 10
  } = options;
  
  try {
    let result;
    
    if (source === 'camera') {
      result = await ImageCropPicker.openCamera({
        mediaType,
        width: maxWidth,
        height: maxHeight,
        compressImageQuality: quality / 100,
        cropping: allowEditing,
        includeBase64,
        includeExif: exif,
        useFrontCamera: options.useFrontCamera
      });
    } else {
      // Gallery source
      result = await ImageCropPicker.openPicker({
        mediaType,
        width: maxWidth,
        height: maxHeight,
        compressImageQuality: quality / 100,
        cropping: allowEditing,
        includeBase64,
        includeExif: exif,
        multiple,
        maxFiles
      });
    }
    
    // Handle multiple selection
    if (multiple && Array.isArray(result)) {
      // Process each image
      const processedImages = await Promise.all(
        result.map(async (image) => {
          // Format response
          return {
            uri: image.path,
            path: image.path,
            filename: image.filename || image.path.split('/').pop(),
            width: image.width,
            height: image.height,
            size: image
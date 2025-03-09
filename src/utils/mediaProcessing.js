// src/utils/mediaProcessing.js
// Improved utilities for image and video processing

import { Platform, Dimensions } from 'react-native';
import RNFS from 'react-native-fs';
import ImageResizer from 'react-native-image-resizer';
import { ProcessingManager } from 'react-native-video-processing';
import { createThumbnail } from 'react-native-create-thumbnail';
import * as ImageManipulator from 'react-native-image-manipulator';
import { FFmpegKit, ReturnCode } from 'react-native-ffmpeg';
import uuid from 'react-native-uuid';

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

// Tracking active processing operations
const activeOperations = new Map();

/**
 * Ensure temp directory exists
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
          const fileAge = now - stats.mtime;
          
          // Delete files older than TTL
          if (fileAge > TEMP_FILE_TTL) {
            // Ensure the file isn't being used in an active operation
            if (!activeOperations.has(file.path)) {
              await RNFS.unlink(file.path);
            }
          }
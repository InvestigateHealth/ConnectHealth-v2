// src/services/PermissionsService.js
// Unified service for handling all app permissions

import { Platform } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import { Alert } from 'react-native';

/**
 * Enum for different permission types
 * @readonly
 * @enum {string}
 */
export const PERMISSION_TYPE = {
  CAMERA: 'CAMERA',
  PHOTO_LIBRARY: 'PHOTO_LIBRARY',
  MICROPHONE: 'MICROPHONE',
  LOCATION: 'LOCATION',
  NOTIFICATIONS: 'NOTIFICATIONS',
  CONTACTS: 'CONTACTS',
  CALENDAR: 'CALENDAR',
  STORAGE: 'STORAGE',
  MEDIA_LIBRARY: 'MEDIA_LIBRARY',
};

/**
 * Get the correct permission constant based on type and platform
 * @param {string} type - Permission type
 * @returns {string} Platform-specific permission constant
 */
const getPermissionConstant = (type) => {
  switch (type) {
    case PERMISSION_TYPE.CAMERA:
      return Platform.select({
        ios: PERMISSIONS.IOS.CAMERA,
        android: PERMISSIONS.ANDROID.CAMERA,
      });
    case PERMISSION_TYPE.PHOTO_LIBRARY:
      return Platform.select({
        ios: PERMISSIONS.IOS.PHOTO_LIBRARY,
        android: Platform.Version >= 33 
          ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
          : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
      });
    case PERMISSION_TYPE.MICROPHONE:
      return Platform.select({
        ios: PERMISSIONS.IOS.MICROPHONE,
        android: PERMISSIONS.ANDROID.RECORD_AUDIO,
      });
    case PERMISSION_TYPE.LOCATION:
      return Platform.select({
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      });
    case PERMISSION_TYPE.NOTIFICATIONS:
      return Platform.select({
        ios: PERMISSIONS.IOS.NOTIFICATIONS,
        android: Platform.Version >= 33 
          ? PERMISSIONS.ANDROID.POST_NOTIFICATIONS
          : null, // No permission needed below Android 13
      });
    case PERMISSION_TYPE.CONTACTS:
      return Platform.select({
        ios: PERMISSIONS.IOS.CONTACTS,
        android: PERMISSIONS.ANDROID.READ_CONTACTS,
      });
    case PERMISSION_TYPE.CALENDAR:
      return Platform.select({
        ios: PERMISSIONS.IOS.CALENDARS,
        android: PERMISSIONS.ANDROID.READ_CALENDAR,
      });
    case PERMISSION_TYPE.STORAGE:
      return Platform.select({
        ios: PERMISSIONS.IOS.MEDIA_LIBRARY,
        android: Platform.Version >= 33 
          ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
          : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
      });
    case PERMISSION_TYPE.MEDIA_LIBRARY:
      return Platform.select({
        ios: PERMISSIONS.IOS.MEDIA_LIBRARY,
        android: Platform.Version >= 33 
          ? [PERMISSIONS.ANDROID.READ_MEDIA_IMAGES, PERMISSIONS.ANDROID.READ_MEDIA_VIDEO]
          : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
      });
    default:
      return null;
  }
};

/**
 * Get permission names for display
 * @param {string} type - Permission type
 * @returns {string} Human-readable permission name
 */
const getPermissionName = (type) => {
  switch (type) {
    case PERMISSION_TYPE.CAMERA:
      return 'Camera';
    case PERMISSION_TYPE.PHOTO_LIBRARY:
      return 'Photo Library';
    case PERMISSION_TYPE.MICROPHONE:
      return 'Microphone';
    case PERMISSION_TYPE.LOCATION:
      return 'Location';
    case PERMISSION_TYPE.NOTIFICATIONS:
      return 'Notifications';
    case PERMISSION_TYPE.CONTACTS:
      return 'Contacts';
    case PERMISSION_TYPE.CALENDAR:
      return 'Calendar';
    case PERMISSION_TYPE.STORAGE:
      return 'Storage';
    case PERMISSION_TYPE.MEDIA_LIBRARY:
      return 'Media Library';
    default:
      return 'Unknown';
  }
};

/**
 * Check if a permission is granted
 * @param {string} type - Permission type
 * @returns {Promise<boolean>} Whether the permission is granted
 */
export const checkPermission = async (type) => {
  try {
    const permission = getPermissionConstant(type);
    if (!permission) return true; // If no permission constant, assume granted
    
    // Handle special case for media library on Android 13+
    if (Array.isArray(permission)) {
      const results = await Promise.all(permission.map(perm => check(perm)));
      // Consider granted only if all permissions are granted
      return results.every(result => result === RESULTS.GRANTED);
    }
    
    const result = await check(permission);
    return result === RESULTS.GRANTED;
  } catch (error) {
    console.error(`Error checking ${type} permission:`, error);
    return false;
  }
};

/**
 * Request a permission
 * @param {string} type - Permission type
 * @returns {Promise<boolean>} Whether the permission was granted
 */
export const requestPermission = async (type) => {
  try {
    const permission = getPermissionConstant(type);
    if (!permission) return true; // If no permission constant, assume granted
    
    // Handle special case for media library on Android 13+
    if (Array.isArray(permission)) {
      const results = await Promise.all(permission.map(perm => request(perm)));
      // Consider granted only if all permissions are granted
      return results.every(result => result === RESULTS.GRANTED);
    }
    
    const result = await request(permission);
    return result === RESULTS.GRANTED;
  } catch (error) {
    console.error(`Error requesting ${type} permission:`, error);
    return false;
  }
};

/**
 * Check permission and request it if not granted
 * @param {string} type - Permission type
 * @param {Object} options - Options
 * @param {string} options.title - Alert title
 * @param {string} options.message - Alert message
 * @param {boolean} options.showSettings - Whether to show settings prompt if denied
 * @returns {Promise<boolean>} Whether the permission is granted
 */
export const checkAndRequestPermission = async (type, options = {}) => {
  const {
    title = 'Permission Required',
    message = `HealthConnect needs access to your ${getPermissionName(type).toLowerCase()} to continue.`,
    showSettings = true,
  } = options;
  
  try {
    // First check if the permission is already granted
    const isGranted = await checkPermission(type);
    
    if (isGranted) {
      return true;
    }
    
    // If not granted, request it
    const wasGranted = await requestPermission(type);
    
    if (wasGranted) {
      return true;
    }
    
    // If still not granted and showSettings is true, prompt user to open settings
    if (showSettings) {
      Alert.alert(
        title,
        `${message} Please enable it in the app settings.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => openSettings().catch(() => console.log('Cannot open settings')) 
          }
        ]
      );
    }
    
    return false;
  } catch (error) {
    console.error(`Error with permission ${type}:`, error);
    return false;
  }
};

/**
 * Check multiple permissions
 * @param {Array<string>} types - Array of permission types
 * @returns {Promise<Object>} Object with permission types as keys and boolean values
 */
export const checkMultiplePermissions = async (types) => {
  try {
    const results = {};
    
    await Promise.all(
      types.map(async (type) => {
        const isGranted = await checkPermission(type);
        results[type] = isGranted;
      })
    );
    
    return results;
  } catch (error) {
    console.error('Error checking multiple permissions:', error);
    return {};
  }
};

/**
 * Request multiple permissions
 * @param {Array<string>} types - Array of permission types
 * @returns {Promise<Object>} Object with permission types as keys and boolean values
 */
export const requestMultiplePermissions = async (types) => {
  try {
    const results = {};
    
    await Promise.all(
      types.map(async (type) => {
        const isGranted = await requestPermission(type);
        results[type] = isGranted;
      })
    );
    
    return results;
  } catch (error) {
    console.error('Error requesting multiple permissions:', error);
    return {};
  }
};

export default {
  PERMISSION_TYPE,
  checkPermission,
  requestPermission,
  checkAndRequestPermission,
  checkMultiplePermissions,
  requestMultiplePermissions,
};
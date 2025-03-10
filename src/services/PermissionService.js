// src/services/PermissionService.js
// Comprehensive permission handling with clear user messaging

import { Alert, Linking, Platform } from 'react-native';
import { check, request, RESULTS, PERMISSIONS, openSettings } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsService } from './AnalyticsService';

class PermissionService {
  constructor() {
    // Track user's permission denials to avoid excessive prompting
    this.deniedPermissions = {};
    
    // Define permission types with user-friendly explanations
    this.permissionTypes = {
      camera: {
        ios: PERMISSIONS.IOS.CAMERA,
        android: PERMISSIONS.ANDROID.CAMERA,
        explanation: 'The camera is needed to take photos for your profile and posts.',
        name: 'Camera',
        usage: 'taking photos and videos',
      },
      photoLibrary: {
        ios: PERMISSIONS.IOS.PHOTO_LIBRARY,
        android: PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
        explanation: 'Access to your photos is needed to upload images to your posts.',
        name: 'Photo Library',
        usage: 'sharing photos in posts',
      },
      location: {
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        explanation: 'Location is used to show nearby events and connect with local users.',
        name: 'Location',
        usage: 'finding nearby events',
      },
      notifications: {
        ios: PERMISSIONS.IOS.NOTIFICATIONS,
        android: Platform.Version >= 33 ? PERMISSIONS.ANDROID.POST_NOTIFICATIONS : undefined,
        explanation: 'Notifications keep you updated on new messages and important events.',
        name: 'Notifications',
        usage: 'receiving updates and messages',
      },
      microphone: {
        ios: PERMISSIONS.IOS.MICROPHONE,
        android: PERMISSIONS.ANDROID.RECORD_AUDIO,
        explanation: 'The microphone is needed for recording videos with sound.',
        name: 'Microphone',
        usage: 'recording videos with audio',
      },
    };
  }

  // Initialize from stored preferences
  async initialize() {
    try {
      const deniedJson = await AsyncStorage.getItem('deniedPermissions');
      if (deniedJson) {
        this.deniedPermissions = JSON.parse(deniedJson);
      }
    } catch (error) {
      console.error('Error loading denied permissions:', error);
    }
  }

  // Save denied permissions to storage
  async saveDeniedPermissions() {
    try {
      await AsyncStorage.setItem('deniedPermissions', JSON.stringify(this.deniedPermissions));
    } catch (error) {
      console.error('Error saving denied permissions:', error);
    }
  }

  // Get the platform-specific permission constant
  getPermission(permissionType) {
    const permConfig = this.permissionTypes[permissionType];
    if (!permConfig) {
      throw new Error(`Unknown permission type: ${permissionType}`);
    }
    
    return Platform.OS === 'ios' ? permConfig.ios : permConfig.android;
  }

  // Check if a permission is granted
  async checkPermission(permissionType) {
    try {
      const permission = this.getPermission(permissionType);
      
      // Skip if permission is not applicable on this platform/version
      if (!permission) {
        return { granted: true, notApplicable: true };
      }
      
      const result = await check(permission);
      
      const isGranted = result === RESULTS.GRANTED || result === RESULTS.LIMITED;
      
      // Log permission check
      AnalyticsService.logEvent('permission_check', {
        permission: permissionType,
        result,
        granted: isGranted,
      });
      
      return {
        granted: isGranted,
        limited: result === RESULTS.LIMITED,
        result,
      };
    } catch (error) {
      console.error(`Error checking ${permissionType} permission:`, error);
      AnalyticsService.logError(error, { 
        context: 'check_permission',
        permissionType,
      });
      
      return { granted: false, error: error.message };
    }
  }

  // Request a permission with proper explanation
  async requestPermission(permissionType, options = {}) {
    try {
      const permission = this.getPermission(permissionType);
      
      // Skip if permission is not applicable on this platform/version
      if (!permission) {
        return { granted: true, notApplicable: true };
      }
      
      const permInfo = this.permissionTypes[permissionType];
      
      // Check if permission has been previously denied multiple times
      const deniedInfo = this.deniedPermissions[permissionType];
      const deniedCount = deniedInfo ? deniedInfo.count : 0;
      
      // If denied too many times and not forced, show settings dialog
      if (deniedCount >= 2 && !options.force) {
        return this.promptSettings(permissionType);
      }
      
      // Check current status first
      const { result } = await this.checkPermission(permissionType);
      
      if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
        return { granted: true, result };
      }
      
      // Show explanation dialog if it's not a retry or blocked
      if (result !== RESULTS.DENIED || options.skipExplanation) {
        // If permission is blocked, we need to direct to settings
        if (result === RESULTS.BLOCKED) {
          return this.promptSettings(permissionType);
        }
      } else if (!options.skipExplanation) {
        // Show explanation before requesting
        const shouldContinue = await new Promise(resolve => {
          Alert.alert(
            `${permInfo.name} Access`,
            `${permInfo.explanation}`,
            [
              {
                text: 'Not Now',
                onPress: () => resolve(false),
                style: 'cancel',
              },
              {
                text: 'Continue',
                onPress: () => resolve(true),
              },
            ],
            { cancelable: false }
          );
        });
        
        if (!shouldContinue) {
          // User declined at explanation stage
          this.trackDenial(permissionType);
          
          return { 
            granted: false, 
            result: 'EXPLANATION_DECLINED',
            message: 'User declined to continue after explanation'
          };
        }
      }
      
      // Request the permission
      const requestResult = await request(permission);
      
      const isGranted = requestResult === RESULTS.GRANTED || requestResult === RESULTS.LIMITED;
      
      // Track the result
      if (!isGranted) {
        this.trackDenial(permissionType);
      } else {
        // Reset denial count if permission granted
        delete this.deniedPermissions[permissionType];
        await this.saveDeniedPermissions();
      }
      
      // Log permission request
      AnalyticsService.logEvent('permission_request', {
        permission: permissionType,
        result: requestResult,
        granted: isGranted,
        deniedCount: !isGranted ? (deniedCount + 1) : 0,
      });
      
      return {
        granted: isGranted,
        limited: requestResult === RESULTS.LIMITED,
        result: requestResult,
      };
    } catch (error) {
      console.error(`Error requesting ${permissionType} permission:`, error);
      AnalyticsService.logError(error, { 
        context: 'request_permission',
        permissionType,
      });
      
      return { granted: false, error: error.message };
    }
  }
  
  // Track permission denial to avoid excessive prompting
  async trackDenial(permissionType) {
    try {
      const deniedInfo = this.deniedPermissions[permissionType] || { count: 0, lastDenied: null };
      
      deniedInfo.count += 1;
      deniedInfo.lastDenied = new Date().toISOString();
      
      this.deniedPermissions[permissionType] = deniedInfo;
      
      await this.saveDeniedPermissions();
    } catch (error) {
      console.error(`Error tracking ${permissionType} permission denial:`, error);
    }
  }
  
  // Prompt user to open settings when permission persistently denied
  async promptSettings(permissionType) {
    const permInfo = this.permissionTypes[permissionType];
    
    try {
      const shouldOpenSettings = await new Promise(resolve => {
        Alert.alert(
          `${permInfo.name} Access Required`,
          `We need access to your ${permInfo.name.toLowerCase()} for ${permInfo.usage}. Please enable it in your device settings.`,
          [
            {
              text: 'Not Now',
              onPress: () => resolve(false),
              style: 'cancel',
            },
            {
              text: 'Open Settings',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: false }
        );
      });
      
      if (shouldOpenSettings) {
        await openSettings();
        
        AnalyticsService.logEvent('settings_opened_for_permission', {
          permission: permissionType,
        });
        
        return { 
          granted: false, 
          result: 'REDIRECTED_TO_SETTINGS',
          message: 'User was redirected to settings'
        };
      } else {
        AnalyticsService.logEvent('settings_redirect_declined', {
          permission: permissionType,
        });
        
        return { 
          granted: false, 
          result: 'SETTINGS_DECLINED',
          message: 'User declined to open settings'
        };
      }
    } catch (error) {
      console.error(`Error prompting settings for ${permissionType}:`, error);
      AnalyticsService.logError(error, { 
        context: 'prompt_settings',
        permissionType,
      });
      
      return { granted: false, error: error.message };
    }
  }
  
  // Request multiple permissions in sequence
  async requestMultiplePermissions(permissionTypes, options = {}) {
    const results = {};
    
    for (const type of permissionTypes) {
      results[type] = await this.requestPermission(type, options);
      
      // If we're forcing all and one fails, continue anyway
      if (!options.forceAll && !results[type].granted) {
        break;
      }
    }
    
    return results;
  }
  
  // Check if all required permissions are granted
  async checkRequiredPermissions(requiredPermissions) {
    const results = {};
    let allGranted = true;
    
    for (const type of requiredPermissions) {
      results[type] = await this.checkPermission(type);
      if (!results[type].granted) {
        allGranted = false;
      }
    }
    
    return {
      allGranted,
      results,
    };
  }
}

export default new PermissionService();

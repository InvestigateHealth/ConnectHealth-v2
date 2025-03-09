// src/services/AnalyticsService.js
// Service for tracking analytics events in the app

import { Platform } from 'react-native';
import { Amplitude } from 'react-native-analytics-amplitude';
import DeviceInfo from 'react-native-device-info';
import Config from 'react-native-config';
import { getUniqueId } from 'react-native-device-info';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// Initialize Amplitude with API keys from config
const AMPLITUDE_API_KEY = Config.AMPLITUDE_API_KEY || '';

// Flag to enable/disable analytics in development
const ANALYTICS_ENABLED = !__DEV__ || Config.FORCE_ANALYTICS === 'true';

// User property constants
const USER_PROPERTIES = {
  DEVICE_TYPE: 'deviceType',
  APP_VERSION: 'appVersion',
  OS_VERSION: 'osVersion',
  PLATFORM: 'platform',
  LAST_UPDATED: 'lastUpdated',
};

// Initialize flag
let hasInitialized = false;

// Initialize analytics
const initializeAnalytics = async () => {
  if (hasInitialized || !ANALYTICS_ENABLED) return;
  
  try {
    await Amplitude.initializeInstance({
      instanceName: 'healthconnect',
      apiKey: AMPLITUDE_API_KEY,
    });
    
    hasInitialized = true;
    
    // Set device info as user properties
    const deviceType = DeviceInfo.getDeviceType();
    const appVersion = DeviceInfo.getVersion();
    const buildNumber = DeviceInfo.getBuildNumber();
    const osVersion = DeviceInfo.getSystemVersion();
    
    await Amplitude.setUserProperties({
      [USER_PROPERTIES.DEVICE_TYPE]: deviceType,
      [USER_PROPERTIES.APP_VERSION]: `${appVersion} (${buildNumber})`,
      [USER_PROPERTIES.OS_VERSION]: osVersion,
      [USER_PROPERTIES.PLATFORM]: Platform.OS,
      [USER_PROPERTIES.LAST_UPDATED]: new Date().toISOString(),
    });
    
    console.log('Analytics initialized successfully');
  } catch (error) {
    console.error('Failed to initialize analytics:', error);
  }
};

// Call initialize when the module is imported
initializeAnalytics();

/**
 * Identify user for analytics
 * @param {string} userId - The user ID
 * @param {Object} userProperties - Additional user properties
 */
const identifyUser = async (userId, userProperties = {}) => {
  if (!ANALYTICS_ENABLED || !hasInitialized) return;
  
  try {
    // Set user ID in Amplitude
    await Amplitude.setUserId(userId);
    
    // Set user properties
    if (Object.keys(userProperties).length > 0) {
      await Amplitude.setUserProperties(userProperties);
    }
    
    // Update analytics settings in Firestore
    const user = auth().currentUser;
    if (user) {
      await firestore().collection('users').doc(user.uid).update({
        analytics: {
          lastActive: firestore.FieldValue.serverTimestamp(),
          deviceId: await getUniqueId(),
          platform: Platform.OS,
          version: DeviceInfo.getVersion()
        }
      });
    }
  } catch (error) {
    console.error('Error identifying user for analytics:', error);
  }
};

/**
 * Reset user identification (e.g., on logout)
 */
const resetUser = async () => {
  if (!ANALYTICS_ENABLED || !hasInitialized) return;
  
  try {
    await Amplitude.clearUserProperties();
    await Amplitude.setUserId(null);
  } catch (error) {
    console.error('Error resetting analytics user:', error);
  }
};

/**
 * Log an event to analytics
 * @param {string} eventName - Name of the event
 * @param {Object} eventProperties - Properties for the event
 */
const logEvent = async (eventName, eventProperties = {}) => {
  if (!ANALYTICS_ENABLED || !hasInitialized) return;
  
  try {
    await Amplitude.logEvent({
      eventType: eventName,
      eventProperties,
    });
  } catch (error) {
    console.error(`Error logging event ${eventName}:`, error);
  }
};

/**
 * Log a screen view event
 * @param {string} screenName - Name of the screen
 * @param {Object} properties - Additional properties
 */
const logScreenView = async (screenName, properties = {}) => {
  await logEvent('screen_view', {
    screen_name: screenName,
    ...properties,
  });
};

/**
 * Log an error event
 * @param {string} errorMessage - Error message
 * @param {string} errorSource - Source of the error
 * @param {Object} additionalInfo - Additional error info
 */
const logError = async (errorMessage, errorSource, additionalInfo = {}) => {
  await logEvent('error', {
    error_message: errorMessage,
    error_source: errorSource,
    ...additionalInfo,
  });
};

export const AnalyticsService = {
  identifyUser,
  resetUser,
  logEvent,
  logScreenView,
  logError,
};

export default AnalyticsService;

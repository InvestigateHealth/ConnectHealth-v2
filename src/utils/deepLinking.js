// src/utils/deepLinking.js
// Utility to handle deep links and URL schemes in the app

import { Linking } from 'react-native';
import { DeepLinking } from 'react-native-deep-linking';
import { AnalyticsService } from '../services/AnalyticsService';

// URL scheme for the app
export const APP_URL_SCHEME = 'healthconnect://';

// Web domain for universal links (iOS) and app links (Android)
export const APP_WEB_DOMAIN = 'healthconnect.example.com';

/**
 * Initialize deep linking handlers
 * @param {Object} navigation - Navigation object
 */
export const initializeDeepLinking = (navigation) => {
  // Configure deep linking routes
  DeepLinking.addScheme(APP_URL_SCHEME);
  
  // User profile deep link
  DeepLinking.addRoute('user/:userId', (params) => {
    const { userId } = params;
    if (userId) {
      navigation.navigate('UserProfile', { userId });
      AnalyticsService.logEvent('deep_link_open', { 
        type: 'user_profile', 
        userId 
      });
    }
  });
  
  // Post deep link
  DeepLinking.addRoute('post/:postId', (params) => {
    const { postId } = params;
    if (postId) {
      navigation.navigate('PostDetail', { postId });
      AnalyticsService.logEvent('deep_link_open', { 
        type: 'post_detail', 
        postId 
      });
    }
  });
  
  // Event deep link
  DeepLinking.addRoute('event/:eventId', (params) => {
    const { eventId } = params;
    if (eventId) {
      navigation.navigate('EventDetail', { eventId });
      AnalyticsService.logEvent('deep_link_open', { 
        type: 'event_detail', 
        eventId 
      });
    }
  });
  
  // Comments deep link
  DeepLinking.addRoute('comments/:postId', (params) => {
    const { postId } = params;
    if (postId) {
      navigation.navigate('Comments', { postId });
      AnalyticsService.logEvent('deep_link_open', { 
        type: 'comments', 
        postId 
      });
    }
  });
  
  // Handle web URLs using the web domain
  DeepLinking.addRoute(`https://${APP_WEB_DOMAIN}/user/:userId`, (params) => {
    const { userId } = params;
    if (userId) {
      navigation.navigate('UserProfile', { userId });
      AnalyticsService.logEvent('deep_link_open', { 
        type: 'web_user_profile',
        userId 
      });
    }
  });
  
  DeepLinking.addRoute(`https://${APP_WEB_DOMAIN}/post/:postId`, (params) => {
    const { postId } = params;
    if (postId) {
      navigation.navigate('PostDetail', { postId });
      AnalyticsService.logEvent('deep_link_open', { 
        type: 'web_post_detail',
        postId 
      });
    }
  });
  
  // Initialize URL handling
  Linking.addEventListener('url', handleUrl);
  
  // Check for initial URL
  checkInitialUrl();
};

/**
 * Handle URL open events
 * @param {Object} event - URL event
 */
const handleUrl = (event) => {
  const { url } = event;
  if (url) {
    DeepLinking.evaluateUrl(url);
  }
};

/**
 * Check for initial URL when app opens
 */
const checkInitialUrl = async () => {
  try {
    const url = await Linking.getInitialURL();
    if (url) {
      DeepLinking.evaluateUrl(url);
    }
  } catch (error) {
    console.error('Error getting initial URL:', error);
  }
};

/**
 * Create a deep link URL for sharing
 * @param {string} type - Type of link (user, post, event)
 * @param {string} id - ID to include in the link
 * @param {boolean} useWebUrl - Whether to use web URL format
 * @returns {string} Deep link URL
 */
export const createDeepLink = (type, id, useWebUrl = false) => {
  if (!type || !id) return '';
  
  if (useWebUrl) {
    return `https://${APP_WEB_DOMAIN}/${type}/${id}`;
  } else {
    return `${APP_URL_SCHEME}${type}/${id}`;
  }
};

/**
 * Clean up deep linking listeners
 */
export const cleanupDeepLinking = () => {
  Linking.removeAllListeners('url');
};

export default {
  initializeDeepLinking,
  createDeepLink,
  cleanupDeepLinking,
  APP_URL_SCHEME,
  APP_WEB_DOMAIN,
};

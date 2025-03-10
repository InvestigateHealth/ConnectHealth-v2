// src/utils/deepLinking.js
// Enhanced deep linking support for handling URLs across the app

import { Linking, Platform } from 'react-native';
import { AnalyticsService } from '../services/AnalyticsService';
import Config from 'react-native-config';
import navigationService from '../services/NavigationService';

// Get the deep link domain from config or use a default
const DEEP_LINK_DOMAIN = Config.DEEP_LINK_DOMAIN || 'healthconnect.app';
const APP_SCHEME = Config.APP_SCHEME || 'healthconnect://';

/**
 * Parse a deep link URL into structured data
 * @param {string} url - The deep link URL
 * @returns {Object} Parsed deep link data
 */
export const parseDeepLink = (url) => {
  if (!url) return null;
  
  try {
    let path, queryParams = {};
    
    // Handle different URL formats (universal links vs custom scheme)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Universal link format (https://healthconnect.app/...)
      const parsedUrl = new URL(url);
      
      // Extract the path without leading slash
      path = parsedUrl.pathname.replace(/^\/+/, '');
      
      // Parse query parameters
      parsedUrl.searchParams.forEach((value, key) => {
        queryParams[key] = value;
      });
    } else if (url.startsWith(APP_SCHEME)) {
      // Custom URL scheme (healthconnect://...)
      const cleanUrl = url.replace(APP_SCHEME, '');
      
      // Split path and query string
      const [pathPart, queryPart] = cleanUrl.split('?');
      path = pathPart;
      
      // Parse query parameters if they exist
      if (queryPart) {
        queryPart.split('&').forEach(param => {
          const [key, value] = param.split('=');
          if (key && value) {
            queryParams[key] = decodeURIComponent(value);
          }
        });
      }
    } else {
      // Unrecognized URL format
      return null;
    }
    
    // Split path into segments
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length === 0) {
      return null;
    }
    
    // Determine the type of deep link based on the first path segment
    const type = segments[0];
    const id = segments.length > 1 ? segments[1] : null;
    
    return {
      type,
      id,
      segments,
      queryParams,
      originalUrl: url
    };
  } catch (error) {
    console.error('Error parsing deep link:', error);
    AnalyticsService.logError(error, { context: 'parse_deep_link', url });
    return null;
  }
};

/**
 * Handle a deep link URL
 * @param {string} url - The deep link URL
 * @returns {boolean} Whether the deep link was handled
 */
export const handleDeepLink = (url) => {
  try {
    if (!url) return false;
    
    // Parse the deep link
    const parsedLink = parseDeepLink(url);
    
    if (!parsedLink) return false;
    
    // Log the deep link for analytics
    AnalyticsService.logEvent('deep_link_opened', {
      type: parsedLink.type,
      hasId: !!parsedLink.id,
      url
    });
    
    // Handle different deep link types
    switch (parsedLink.type) {
      case 'post': 
        if (parsedLink.id) {
          navigationService.navigate('PostDetails', { postId: parsedLink.id });
          return true;
        }
        break;
        
      case 'profile':
        if (parsedLink.id) {
          navigationService.navigate('ProfileScreen', { userId: parsedLink.id });
          return true;
        }
        break;
        
      case 'event':
        if (parsedLink.id) {
          navigationService.navigate('EventDetails', { eventId: parsedLink.id });
          return true;
        }
        break;
        
      case 'reset-password':
        if (parsedLink.id) {
          navigationService.navigate('ResetPassword', { token: parsedLink.id });
          return true;
        }
        break;
        
      case 'share':
        // Handle share URLs
        if (parsedLink.segments.length > 2) {
          const shareType = parsedLink.segments[1];
          const shareId = parsedLink.segments[2];
          
          switch (shareType) {
            case 'post':
              navigationService.navigate('PostDetails', { postId: shareId });
              return true;
              
            case 'event':
              navigationService.navigate('EventDetails', { eventId: shareId });
              return true;
              
            case 'profile':
              navigationService.navigate('ProfileScreen', { userId: shareId });
              return true;
          }
        }
        break;
        
      case 'notification':
        // Handle deep links from notifications
        if (parsedLink.id) {
          navigationService.navigate('NotificationDetails', { notificationId: parsedLink.id });
          return true;
        }
        break;
        
      case 'settings':
        // Navigate to specific settings screens
        if (parsedLink.segments.length > 1) {
          const settingType = parsedLink.segments[1];
          
          switch (settingType) {
            case 'profile':
              navigationService.navigate('ProfileSettings');
              return true;
              
            case 'privacy':
              navigationService.navigate('PrivacySettings');
              return true;
              
            case 'notifications':
              navigationService.navigate('NotificationSettings');
              return true;
              
            case 'account':
              navigationService.navigate('AccountSettings');
              return true;
          }
        } else {
          // Navigate to main settings
          navigationService.navigate('Settings');
          return true;
        }
        break;
    }
    
    return false;
  } catch (error) {
    console.error('Error handling deep link:', error);
    AnalyticsService.logError(error, { context: 'handle_deep_link', url });
    return false;
  }
};

/**
 * Initialize deep linking listeners
 * @param {object} navigation - React Navigation reference
 * @returns {function} Cleanup function
 */
export const initializeDeepLinking = (navigation) => {
  // Store initial URL
  let initialUrl = null;
  
  // Handle incoming links when app is already running
  const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
    handleDeepLink(url);
  });
  
  // Check for initial URL that launched the app
  Linking.getInitialURL().then(url => {
    initialUrl = url;
    if (url) {
      handleDeepLink(url);
    }
  }).catch(error => {
    console.error('Error getting initial URL:', error);
    AnalyticsService.logError(error, { context: 'get_initial_url' });
  });
  
  // Return cleanup function
  return () => {
    linkingSubscription.remove();
  };
};

/**
 * Clean up deep linking
 */
export const cleanupDeepLinking = () => {
  // This is just a placeholder function for now
  // In the future, we might need to do more cleanup here
};

/**
 * Generate a deep link URL
 * @param {string} type - Type of content
 * @param {string} id - Content ID
 * @param {object} params - Additional parameters
 * @returns {string} Deep link URL
 */
export const generateDeepLink = (type, id, params = {}) => {
  try {
    // Use https for universal links
    let url = `https://${DEEP_LINK_DOMAIN}/${type}`;
    
    if (id) {
      url += `/${id}`;
    }
    
    // Add query parameters
    if (Object.keys(params).length > 0) {
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      
      url += `?${queryString}`;
    }
    
    return url;
  } catch (error) {
    console.error('Error generating deep link:', error);
    AnalyticsService.logError(error, { context: 'generate_deep_link' });
    return null;
  }
};

export default {
  parseDeepLink,
  handleDeepLink,
  initializeDeepLinking,
  cleanupDeepLinking,
  generateDeepLink
};
// src/utils/deepLinking.js
// Enhanced deep linking with better error handling and analytics

import { Linking } from 'react-native';
import Config from 'react-native-config';
import { AnalyticsService } from '../services/AnalyticsService';

// Define deep link mapping structure
const DEEP_LINK_MAPPING = {
  'post': {
    path: 'posts/:postId',
    screen: 'PostDetails',
    parseParams: params => ({
      postId: params.postId,
    }),
  },
  'user': {
    path: 'users/:userId',
    screen: 'UserProfile',
    parseParams: params => ({
      userId: params.userId,
      initialTab: params.tab || 'posts',
    }),
  },
  'event': {
    path: 'events/:eventId',
    screen: 'EventDetails',
    parseParams: params => ({
      eventId: params.eventId,
    }),
  },
  'chat': {
    path: 'chats/:chatId',
    screen: 'ChatScreen',
    parseParams: params => ({
      chatId: params.chatId,
    }),
  },
  'message': {
    path: 'messages/:messageId',
    screen: 'MessageDetails',
    parseParams: params => ({
      messageId: params.messageId,
      chatId: params.chatId,
    }),
  },
  'settings': {
    path: 'settings/:section?',
    screen: 'Settings',
    parseParams: params => ({
      section: params.section || 'general',
    }),
  },
  'reset-password': {
    path: 'reset-password',
    screen: 'ResetPassword',
    parseParams: params => ({
      token: params.token,
      email: params.email,
    }),
  },
  'invite': {
    path: 'invite/:inviteCode',
    screen: 'InviteScreen',
    parseParams: params => ({
      inviteCode: params.inviteCode,
    }),
  },
  'share': {
    path: 'share/:type/:id',
    screen: 'SharedContent',
    parseParams: params => ({
      contentType: params.type,
      contentId: params.id,
    }),
  },
};

// Get the domain from config or use default
const DEEP_LINK_DOMAIN = Config.DEEP_LINK_DOMAIN || 'healthconnect.app';
const DEEP_LINK_SCHEME = __DEV__ ? 'healthconnectdev' : 'healthconnect';
const DEEP_LINK_PREFIX_HTTPS = `https://${DEEP_LINK_DOMAIN}/`;
const DEEP_LINK_PREFIX_APP = `${DEEP_LINK_SCHEME}://`;

/**
 * Parse and validate a deep link URL
 * @param {string} url The deep link URL to parse
 * @returns {object|null} Parsed link data or null if invalid
 */
export const parseDeepLink = (url) => {
  try {
    if (!url) return null;
    
    // Determine if it's a web URL or app scheme
    let path;
    let isHttps = false;
    
    if (url.startsWith(DEEP_LINK_PREFIX_HTTPS)) {
      path = url.substring(DEEP_LINK_PREFIX_HTTPS.length);
      isHttps = true;
    } else if (url.startsWith(DEEP_LINK_PREFIX_APP)) {
      path = url.substring(DEEP_LINK_PREFIX_APP.length);
    } else {
      // Not a valid deep link for this app
      return null;
    }
    
    // Extract query parameters
    const queryParamIndex = path.indexOf('?');
    let queryParams = {};
    
    if (queryParamIndex >= 0) {
      const queryString = path.substring(queryParamIndex + 1);
      path = path.substring(0, queryParamIndex);
      
      // Parse query string into object
      queryParams = queryString.split('&').reduce((params, param) => {
        const [key, value] = param.split('=');
        if (key && value) {
          params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
        return params;
      }, {});
    }
    
    // Remove trailing slash if present
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    // Find matching route
    for (const [key, routeConfig] of Object.entries(DEEP_LINK_MAPPING)) {
      const pathPattern = routeConfig.path;
      const pathSegments = pathPattern.split('/');
      const urlSegments = path.split('/');
      
      // Skip if segment count doesn't match (unless there are optional params)
      if (!pathPattern.includes('?') && pathSegments.length !== urlSegments.length) {
        continue;
      }
      
      let isMatch = true;
      const routeParams = {};
      
      // Compare each segment
      for (let i = 0; i < pathSegments.length; i++) {
        const patternSegment = pathSegments[i];
        const urlSegment = urlSegments[i];
        
        // If this is a parameter segment (starts with :)
        if (patternSegment.startsWith(':')) {
          const paramName = patternSegment.substring(1);
          // Check if optional (ends with ?)
          const isOptional = paramName.endsWith('?');
          const cleanParamName = isOptional ? paramName.slice(0, -1) : paramName;
          
          // If parameter is present in URL, add it to route params
          if (urlSegment) {
            routeParams[cleanParamName] = urlSegment;
          } else if (!isOptional) {
            // Required parameter is missing
            isMatch = false;
            break;
          }
        } else if (patternSegment !== urlSegment) {
          // Static segment doesn't match
          isMatch = false;
          break;
        }
      }
      
      if (isMatch) {
        // We found a matching route
        const screen = routeConfig.screen;
        let params = {};
        
        // Combine route params and query params
        const combinedParams = { ...routeParams, ...queryParams };
        
        // Use custom param parser if provided
        if (routeConfig.parseParams) {
          params = routeConfig.parseParams(combinedParams);
        } else {
          params = combinedParams;
        }
        
        return {
          type: key,
          screen,
          params,
          url,
          isHttps,
        };
      }
    }
    
    // No matching route found
    return null;
  } catch (error) {
    console.error('Error parsing deep link:', error, url);
    AnalyticsService.logError(error, { 
      context: 'parse_deep_link', 
      url 
    });
    return null;
  }
};

/**
 * Initialize deep linking event listeners
 * @param {object} navigation A navigation object with navigate method
 * @returns {function} Cleanup function to call on unmount
 */
export const initializeDeepLinking = (navigation) => {
  if (!navigation) {
    throw new Error('Navigation object is required for deep linking');
  }
  
  /**
   * Handle received deep link
   * @param {object} event Linking event with url property
   */
  const handleDeepLink = (event) => {
    try {
      const url = event.url || event;
      const linkData = parseDeepLink(url);
      
      if (linkData) {
        // Log deep link navigation
        AnalyticsService.logEvent('deep_link_opened', {
          url,
          type: linkData.type,
          screen: linkData.screen,
          params: JSON.stringify(linkData.params),
        });
        
        // Navigate to the appropriate screen
        navigation.navigate(linkData.screen, linkData.params);
        
        return true;
      } else {
        console.warn('No matching route found for deep link:', url);
        
        // Log unmatched deep link
        AnalyticsService.logEvent('deep_link_unmatched', {
          url,
        });
        
        return false;
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
      AnalyticsService.logError(error, { 
        context: 'handle_deep_link',
        url: event.url || event,
      });
      return false;
    }
  };
  
  // Listen for incoming links when app is already running
  const eventListener = Linking.addEventListener('url', handleDeepLink);
  
  // Check for any pending initial URL that launched the app
  Linking.getInitialURL()
    .then(url => {
      if (url) {
        handleDeepLink(url);
      }
    })
    .catch(error => {
      console.error('Error getting initial URL:', error);
      AnalyticsService.logError(error, { context: 'get_initial_url' });
    });
  
  // Return cleanup function
  return () => {
    if (eventListener && typeof eventListener.remove === 'function') {
      eventListener.remove();
    }
  };
};

/**
 * Clean up deep linking event listeners
 */
export const cleanupDeepLinking = () => {
  Linking.removeAllListeners('url');
};

/**
 * Generate a deep link for sharing
 * @param {string} type The type of content (must be defined in DEEP_LINK_MAPPING)
 * @param {object} params Parameters for the deep link
 * @param {boolean} useHttps Whether to use HTTPS links (default) or app scheme
 * @returns {string|null} Generated deep link URL or null if invalid
 */
export const generateDeepLink = (type, params = {}, useHttps = true) => {
  try {
    // Validate the type
    const routeConfig = DEEP_LINK_MAPPING[type];
    if (!routeConfig) {
      console.error(`Invalid deep link type: ${type}`);
      return null;
    }
    
    // Start with the path pattern
    let path = routeConfig.path;
    
    // Replace route parameters in the path
    for (const [key, value] of Object.entries(params)) {
      const paramPattern = `:${key}`;
      const optionalParamPattern = `:${key}?`;
      
      if (path.includes(paramPattern)) {
        path = path.replace(paramPattern, encodeURIComponent(value));
      } else if (path.includes(optionalParamPattern)) {
        path = path.replace(optionalParamPattern, encodeURIComponent(value));
      }
    }
    
    // Remove any remaining optional parameters
    path = path.replace(/\/:[^\/]+\?/g, '');
    
    // Generate the full URL with appropriate prefix
    const prefix = useHttps ? DEEP_LINK_PREFIX_HTTPS : DEEP_LINK_PREFIX_APP;
    
    return `${prefix}${path}`;
  } catch (error) {
    console.error('Error generating deep link:', error);
    AnalyticsService.logError(error, { 
      context: 'generate_deep_link',
      type,
      params: JSON.stringify(params),
    });
    return null;
  }
};

// src/utils/deepLinking.js
// Utility for handling deep linking functionality

import { Linking } from 'react-native';
import { AnalyticsService } from '../services/AnalyticsService';

/**
 * Initialize deep linking
 * @param {Object} navigationRef - Navigation reference from React Navigation
 * @returns {Function} Cleanup function
 */
export const initializeDeepLinking = (navigationRef) => {
  // Process the initial URL that opened the app
  const processInitialURL = async () => {
    try {
      const url = await Linking.getInitialURL();
      if (url) {
        handleDeepLink(url, navigationRef);
      }
    } catch (error) {
      console.error('Error processing initial URL:', error);
    }
  };

  // Handle deep link when the app is already open
  const handleUrlEvent = ({ url }) => {
    handleDeepLink(url, navigationRef);
  };

  // Process initial URL that opened the app
  processInitialURL();

  // Add event listener for deep links when app is already open
  const subscription = Linking.addEventListener('url', handleUrlEvent);

  // Return cleanup function
  return () => {
    if (subscription && typeof subscription.remove === 'function') {
      subscription.remove();
    } else {
      Linking.removeEventListener('url', handleUrlEvent);
    }
  };
};

/**
 * Clean up event listeners
 */
export const cleanupDeepLinking = () => {
  Linking.removeAllListeners('url');
};

/**
 * Handle deep link URL
 * @param {string} url - The deep link URL
 * @param {Object} navigationRef - Navigation reference from React Navigation
 */
const handleDeepLink = (url, navigationRef) => {
  if (!url || !navigationRef) return;

  try {
    // Log analytics event
    AnalyticsService.logEvent('deep_link_opened', {
      url
    });

    // Parse URL to extract path and parameters
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
    const queryParams = {};

    // Parse query parameters
    parsedUrl.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // Handle different paths
    switch (path) {
      case 'post':
        if (queryParams.id) {
          navigateToScreen(navigationRef, 'PostDetail', { postId: queryParams.id });
        }
        break;

      case 'profile':
        if (queryParams.id) {
          navigateToScreen(navigationRef, 'UserProfile', { userId: queryParams.id, title: queryParams.name || 'Profile' });
        }
        break;

      case 'event':
        if (queryParams.id) {
          navigateToScreen(navigationRef, 'EventDetail', { eventId: queryParams.id });
        }
        break;

      case 'chat':
        if (queryParams.id) {
          navigateToScreen(navigationRef, 'Chat', { chatId: queryParams.id, userName: queryParams.name || 'Chat' });
        }
        break;

      default:
        console.log('Unhandled deep link path:', path);
    }
  } catch (error) {
    console.error('Error handling deep link:', error);
  }
};

/**
 * Navigate to a screen safely
 * @param {Object} navigationRef - Navigation reference from React Navigation
 * @param {string} screenName - Name of the screen to navigate to
 * @param {Object} params - Parameters to pass to the screen
 */
const navigateToScreen = (navigationRef, screenName, params = {}) => {
  if (navigationRef && navigationRef.isReady()) {
    // Get current route to determine how to navigate
    const currentRoute = navigationRef.getCurrentRoute();
    
    // If we're on a different tab, we need to navigate to that tab first
    const tabScreens = {
      'FeedTab': ['PostDetail', 'UserProfile', 'Comments'],
      'ExploreTab': ['UserProfile', 'Search'],
      'EventsTab': ['EventDetail'],
      'ChatTab': ['Chat', 'UserProfile'],
      'ProfileTab': ['PostDetail', 'Settings', 'ThemeSettings']
    };

    let targetTab = null;
    
    // Find which tab contains the target screen
    Object.entries(tabScreens).forEach(([tab, screens]) => {
      if (screens.includes(screenName)) {
        targetTab = tab;
      }
    });

    // First navigate to the appropriate tab if necessary
    if (targetTab && (!currentRoute || !currentRoute.name.includes(targetTab))) {
      navigationRef.navigate(targetTab);
      
      // Small delay to ensure tab navigation completes before screen navigation
      setTimeout(() => {
        navigationRef.navigate(screenName, params);
      }, 100);
    } else {
      // Direct navigation if already on the correct tab or screen is not tab-specific
      navigationRef.navigate(screenName, params);
    }
  } else {
    console.warn('Navigation not ready for deep linking');
  }
};

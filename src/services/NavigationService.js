// src/services/NavigationService.js
// Service for navigation control outside of React components

import { createRef } from 'react';
import { CommonActions, StackActions } from '@react-navigation/native';

/**
 * Navigation service for handling navigation outside of React components
 */
class NavigationService {
  constructor() {
    this.navigationRef = createRef();
    this.routeNameRef = null;
    this.previousRouteName = null;
    this.navigationOptions = {};
  }

  /**
   * Set the navigation reference
   * @param {object} navigationRef - React Navigation reference
   */
  setNavigationRef(navigationRef) {
    if (navigationRef) {
      this.navigationRef = navigationRef;
    }
  }

  /**
   * Set current route name
   * @param {string} routeName - Current route name
   */
  setCurrentRoute(routeName) {
    this.previousRouteName = this.routeNameRef;
    this.routeNameRef = routeName;
  }

  /**
   * Get current route name
   * @returns {string} Current route name
   */
  getCurrentRoute() {
    return this.routeNameRef;
  }

  /**
   * Get previous route name
   * @returns {string} Previous route name
   */
  getPreviousRoute() {
    return this.previousRouteName;
  }

  /**
   * Check if the navigation reference is ready
   * @returns {boolean} Whether navigation is ready
   */
  isReady() {
    return this.navigationRef && this.navigationRef.current;
  }

  /**
   * Navigate to a screen
   * @param {string} name - Screen name
   * @param {object} params - Screen parameters
   */
  navigate(name, params) {
    if (this.isReady()) {
      this.navigationRef.current.navigate(name, params);
    } else {
      // Save navigation for when ready
      this.navigationOptions = { action: 'navigate', name, params };
    }
  }

  /**
   * Navigate through multiple screens
   * @param {Array<object>} routes - Array of route objects with name and params
   */
  navigateMultiple(routes) {
    if (!this.isReady() || !routes || !routes.length) return;
    
    this.navigationRef.current.dispatch(
      CommonActions.reset({
        index: routes.length - 1,
        routes: routes.map(route => ({
          name: route.name,
          params: route.params
        }))
      })
    );
  }

  /**
   * Replace current screen
   * @param {string} name - Screen name
   * @param {object} params - Screen parameters
   */
  replace(name, params) {
    if (this.isReady()) {
      this.navigationRef.current.dispatch(
        StackActions.replace(name, params)
      );
    }
  }

  /**
   * Go back to previous screen
   */
  goBack() {
    if (this.isReady() && this.navigationRef.current.canGoBack()) {
      this.navigationRef.current.goBack();
    }
  }

  /**
   * Reset navigation state to a route
   * @param {string} name - Route name
   * @param {object} params - Route parameters
   */
  reset(name, params = {}) {
    if (this.isReady()) {
      this.navigationRef.current.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name, params }]
        })
      );
    }
  }

  /**
   * Navigate to a nested screen
   * @param {string} parent - Parent navigator
   * @param {string} screen - Screen name
   * @param {object} params - Screen parameters
   */
  navigateNested(parent, screen, params) {
    if (this.isReady()) {
      this.navigationRef.current.navigate(parent, {
        screen,
        params
      });
    }
  }

  /**
   * Process pending navigation if it exists
   */
  processPendingNavigation() {
    if (Object.keys(this.navigationOptions).length > 0) {
      const { action, name, params } = this.navigationOptions;
      
      switch (action) {
        case 'navigate':
          this.navigate(name, params);
          break;
        case 'reset':
          this.reset(name, params);
          break;
        default:
          break;
      }
      
      this.navigationOptions = {};
    }
  }

  /**
   * Set specific navigation params for the current route
   * @param {object} params - Parameters to set
   */
  setParams(params) {
    if (this.isReady()) {
      this.navigationRef.current.dispatch(
        CommonActions.setParams(params)
      );
    }
  }

  /**
   * Check if navigation can go back
   * @returns {boolean} Whether navigation can go back
   */
  canGoBack() {
    return this.isReady() && this.navigationRef.current.canGoBack();
  }

  /**
   * Handle deep link
   * @param {string} url - Deep link URL
   * @returns {boolean} Whether the deep link was handled
   */
  handleDeepLink(url) {
    if (!url || !this.isReady()) return false;
    
    try {
      // Parse the URL
      const parsedUrl = new URL(url);
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      
      if (pathSegments.length === 0) return false;
      
      // Handle different deep link paths
      switch (pathSegments[0]) {
        case 'post':
          if (pathSegments.length > 1) {
            this.navigate('PostDetails', { postId: pathSegments[1] });
            return true;
          }
          break;
          
        case 'profile':
          if (pathSegments.length > 1) {
            this.navigate('ProfileScreen', { userId: pathSegments[1] });
            return true;
          }
          break;
          
        case 'event':
          if (pathSegments.length > 1) {
            this.navigate('EventDetails', { eventId: pathSegments[1] });
            return true;
          }
          break;
          
        case 'reset-password':
          if (pathSegments.length > 1) {
            this.navigate('ResetPassword', { token: pathSegments[1] });
            return true;
          }
          break;
          
        default:
          return false;
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
      return false;
    }
    
    return false;
  }
}

// Create singleton instance
const navigationService = new NavigationService();

export default navigationService;
// src/services/NavigationService.js
// Navigation helper service for push notifications

import { NavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import React from 'react';

/**
 * Navigation service for handling navigation outside of components
 */
class NavigationServiceImpl {
  constructor() {
    this.navigator = React.createRef();
  }

  /**
   * Initialize with a navigation reference
   * 
   * @param {NavigationContainerRef} navigatorRef - Navigation reference
   */
  init(navigatorRef) {
    this.navigator = navigatorRef;
  }

  /**
   * Navigate to a screen
   * 
   * @param {string} name - Screen name
   * @param {Object} params - Screen parameters
   */
  navigate(name, params) {
    if (this.navigator.current) {
      this.navigator.current.navigate(name, params);
    }
  }

  /**
   * Go back to previous screen
   */
  goBack() {
    if (this.navigator.current) {
      this.navigator.current.goBack();
    }
  }

  /**
   * Reset navigation to a new state
   * 
   * @param {Object} state - New navigation state
   */
  reset(state) {
    if (this.navigator.current) {
      this.navigator.current.reset(state);
    }
  }

  /**
   * Get current route name
   * 
   * @returns {string} Current route name
   */
  getCurrentRouteName() {
    if (this.navigator.current) {
      return this.navigator.current.getCurrentRoute()?.name;
    }
    return null;
  }
}

// Create and export singleton instance
export const NavigationService = new NavigationServiceImpl();

// Export a provider component for initialization
export const NavigationProvider = ({ children }) => {
  const navigationRef = React.useRef(null);
  
  React.useEffect(() => {
    NavigationService.init(navigationRef);
  }, []);
  
  return (
    <NavigationContainer ref={navigationRef}>
      {children}
    </NavigationContainer>
  );
};

export default NavigationService;
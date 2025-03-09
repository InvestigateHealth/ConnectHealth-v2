// src/utils/errorUtils.js
// Centralized error handling utilities

import { Alert, Platform } from 'react-native';
import { Analytics } from '../services/AnalyticsService';

// Error categories
export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  API: 'api',
  AUTH: 'auth',
  PERMISSION: 'permission',
  DATABASE: 'database',
  STORAGE: 'storage',
  VALIDATION: 'validation',
  BUSINESS_LOGIC: 'business_logic',
  UNKNOWN: 'unknown'
};

// Common error messages for user display
export const USER_FRIENDLY_MESSAGES = {
  NETWORK: 'There was a problem connecting to the network. Please check your internet connection and try again.',
  API: 'We\'re having trouble reaching our servers. Please try again later.',
  AUTH: 'There was a problem with your account. Please sign in again.',
  PERMISSION: 'The app doesn\'t have the necessary permissions. Please update your settings and try again.',
  DATABASE: 'We\'re having trouble accessing your data. Please try again.',
  STORAGE: 'We\'re having trouble accessing storage. Please ensure you have enough space and try again.',
  VALIDATION: 'Please check your information and try again.',
  BUSINESS_LOGIC: 'We couldn\'t complete your request. Please try again.',
  UNKNOWN: 'Something went wrong. Please try again later.'
};

/**
 * Format and categorize errors consistently across the app
 * 
 * @param {Error} error - The original error
 * @param {string} source - Where the error originated
 * @param {boolean} reportToAnalytics - Whether to report to analytics
 * @returns {Object} Formatted error object
 */
export const handleError = (error, source = ERROR_CATEGORIES.UNKNOWN, reportToAnalytics = true) => {
  // Extract error details
  const originalError = error instanceof Error ? error : new Error(error?.message || String(error));
  const errorCode = error?.code || 'unknown';
  const errorMessage = error?.message || 'An unknown error occurred';
  
  // Determine error category
  let category = source;
  
  if (errorMessage.includes('network') || errorMessage.includes('connection') || 
      errorMessage.includes('timeout') || errorMessage.includes('offline')) {
    category = ERROR_CATEGORIES.NETWORK;
  } else if (errorCode?.includes('auth/') || errorMessage.includes('auth') || 
             errorMessage.includes('authentication') || errorMessage.includes('unauthenticated')) {
    category = ERROR_CATEGORIES.AUTH;
  } else if (errorMessage.includes('permission') || errorCode?.includes('permission-denied')) {
    category = ERROR_CATEGORIES.PERMISSION;
  } else if (errorCode?.includes('firestore') || errorCode?.includes('database')) {
    category = ERROR_CATEGORIES.DATABASE;
  } else if (errorCode?.includes('storage') || errorMessage.includes('storage')) {
    category = ERROR_CATEGORIES.STORAGE;
  } else if (errorMessage.includes('valid') || errorMessage.includes('required')) {
    category = ERROR_CATEGORIES.VALIDATION;
  }
  
  // Create formatted error
  const formattedError = {
    originalError,
    message: errorMessage,
    code: errorCode,
    category,
    timestamp: new Date().toISOString(),
    userFriendlyMessage: USER_FRIENDLY_MESSAGES[category] || USER_FRIENDLY_MESSAGES.UNKNOWN,
    source,
    platform: Platform.OS,
    deviceInfo: {
      os: Platform.OS,
      version: Platform.Version,
    }
  };
  
  // Report to analytics if enabled
  if (reportToAnalytics) {
    Analytics.logError(
      errorCode || 'app_error',
      errorMessage,
      `${category}:${source}`
    );
  }
  
  return formattedError;
};

/**
 * Display a user-friendly error message alert
 * 
 * @param {Object|Error} error - Error object or formatted error
 * @param {string} title - Alert title
 * @param {Function} onDismiss - Optional callback when alert is dismissed
 */
export const showErrorAlert = (error, title = 'Error', onDismiss = null) => {
  let errorToShow;
  
  // Check if already formatted
  if (error && error.category && error.userFriendlyMessage) {
    errorToShow = error;
  } else {
    // Format the error
    errorToShow = handleError(error);
  }
  
  // Display alert with user friendly message
  Alert.alert(
    title,
    errorToShow.userFriendlyMessage,
    [{ 
      text: 'OK', 
      onPress: onDismiss
    }]
  );
};

/**
 * Wrap a promise with consistent error handling
 * 
 * @param {Promise} promise - Promise to wrap
 * @param {string} source - Error source
 * @param {boolean} showAlert - Whether to show alert on error
 * @returns {Promise} Wrapped promise
 */
export const withErrorHandling = async (promise, source = ERROR_CATEGORIES.UNKNOWN, showAlert = false) => {
  try {
    return await promise;
  } catch (error) {
    const formattedError = handleError(error, source);
    
    if (showAlert) {
      showErrorAlert(formattedError);
    }
    
    throw formattedError;
  }
};

/**
 * Higher-order function to add error handling to async functions
 * 
 * @param {Function} fn - Function to wrap with error handling
 * @param {string} source - Error source
 * @param {boolean} showAlert - Whether to show alert on error
 * @returns {Function} Wrapped function
 */
export const withErrorHandler = (fn, source = ERROR_CATEGORIES.UNKNOWN, showAlert = false) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const formattedError = handleError(error, source);
      
      if (showAlert) {
        showErrorAlert(formattedError);
      }
      
      throw formattedError;
    }
  };
};

export default {
  handleError,
  showErrorAlert,
  withErrorHandling,
  withErrorHandler,
  ERROR_CATEGORIES,
  USER_FRIENDLY_MESSAGES
};

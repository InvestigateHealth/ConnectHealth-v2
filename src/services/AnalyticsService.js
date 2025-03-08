// src/services/AnalyticsService.js
// Analytics and performance monitoring

import analytics from '@react-native-firebase/analytics';
import perf from '@react-native-firebase/perf';
import crashlytics from '@react-native-firebase/crashlytics';
import { Platform } from 'react-native';

/**
 * Analytics Service
 * 
 * Handles tracking events, screen views, and user properties
 */
class AnalyticsService {
  /**
   * Initialize analytics with user data
   * 
   * @param {Object} userData - User data
   */
  init(userData) {
    if (userData && userData.id) {
      this.setUserId(userData.id);
      
      // Set user properties
      if (userData.firstName && userData.lastName) {
        this.setUserProperty('name', `${userData.firstName} ${userData.lastName}`);
      }
      
      if (userData.medicalConditions && userData.medicalConditions.length > 0) {
        this.setUserProperty('conditions', userData.medicalConditions.join(','));
      }
      
      // Log user data to crashlytics for debugging crash reports
      crashlytics().setUserId(userData.id);
      if (userData.email) {
        crashlytics().setAttributes({
          email: userData.email,
          name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
        });
      }
    }
  }

  /**
   * Set user ID for analytics
   * 
   * @param {string} userId - User ID
   */
  setUserId(userId) {
    if (userId) {
      analytics().setUserId(userId);
    }
  }

  /**
   * Set user property for analytics
   * 
   * @param {string} name - Property name
   * @param {string} value - Property value
   */
  setUserProperty(name, value) {
    if (name && value) {
      analytics().setUserProperty(name, value);
    }
  }

  /**
   * Log screen view
   * 
   * @param {string} screenName - Screen name
   * @param {string} screenClass - Screen class name
   */
  logScreenView(screenName, screenClass) {
    analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenClass || screenName,
    });
  }

  /**
   * Log authentication event
   * 
   * @param {string} method - Authentication method
   * @param {boolean} success - Whether authentication succeeded
   */
  logAuthentication(method, success) {
    analytics().logLogin({
      method: method,
      success: success,
    });
  }

  /**
   * Log signup event
   * 
   * @param {string} method - Signup method
   * @param {boolean} success - Whether signup succeeded
   */
  logSignUp(method, success) {
    analytics().logSignUp({
      method: method,
      success: success,
    });
  }

  /**
   * Log content view
   * 
   * @param {string} contentType - Content type (post, profile, etc.)
   * @param {string} itemId - Item ID
   * @param {string} itemName - Item name or title
   */
  logContentView(contentType, itemId, itemName) {
    analytics().logViewItem({
      item_id: itemId,
      item_name: itemName,
      item_category: contentType,
    });
  }

  /**
   * Log social interaction
   * 
   * @param {string} action - Action (like, comment, share, etc.)
   * @param {string} social_type - Social type (post, comment, profile)
   * @param {string} content_id - Content ID
   */
  logSocialInteraction(action, social_type, content_id) {
    analytics().logEvent('social_interaction', {
      action,
      social_type,
      content_id,
    });
  }

  /**
   * Log search event
   * 
   * @param {string} searchTerm - Search term
   * @param {number} resultCount - Result count
   */
  logSearch(searchTerm, resultCount) {
    analytics().logSearch({
      search_term: searchTerm,
      number_of_results: resultCount,
    });
  }

  /**
   * Log error event
   * 
   * @param {string} errorCode - Error code
   * @param {string} errorMessage - Error message
   * @param {string} context - Context where error occurred
   */
  logError(errorCode, errorMessage, context) {
    analytics().logEvent('app_error', {
      error_code: errorCode,
      error_message: errorMessage,
      error_context: context,
    });

    // Log to crashlytics as non-fatal error
    crashlytics().recordError(
      new Error(`${errorCode}: ${errorMessage} (${context})`)
    );
  }

  /**
   * Log custom event
   * 
   * @param {string} eventName - Event name
   * @param {Object} params - Event parameters
   */
  logEvent(eventName, params = {}) {
    analytics().logEvent(eventName, params);
  }
}

// Create and export singleton instance
export const Analytics = new AnalyticsService();

/**
 * Performance Monitoring Service
 * 
 * Handles performance traces and HTTP metrics
 */
class PerformanceService {
  constructor() {
    this.traces = {};
    this.httpMetrics = {};
  }

  /**
   * Start a performance trace
   * 
   * @param {string} traceName - Trace name
   * @returns {Object} Trace object
   */
  async startTrace(traceName) {
    try {
      const trace = await perf().startTrace(traceName);
      this.traces[traceName] = trace;
      return trace;
    } catch (error) {
      console.error('Error starting performance trace:', error);
      return null;
    }
  }

  /**
   * Stop a performance trace
   * 
   * @param {string} traceName - Trace name
   * @param {Object} attributes - Trace attributes
   */
  async stopTrace(traceName, attributes = {}) {
    try {
      const trace = this.traces[traceName];
      if (trace) {
        // Add attributes
        for (const [key, value] of Object.entries(attributes)) {
          await trace.putAttribute(key, String(value));
        }
        
        // Stop trace
        await trace.stop();
        delete this.traces[traceName];
      }
    } catch (error) {
      console.error('Error stopping performance trace:', error);
    }
  }

  /**
   * Create HTTP metric for a network request
   * 
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   * @returns {Object} HTTP metric object
   */
  async createHttpMetric(url, method) {
    try {
      const httpMetric = await perf().newHttpMetric(url, method);
      const key = `${method}:${url}`;
      this.httpMetrics[key] = httpMetric;
      return httpMetric;
    } catch (error) {
      console.error('Error creating HTTP metric:', error);
      return null;
    }
  }

  /**
   * Start HTTP metric
   * 
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   */
  async startHttpMetric(url, method) {
    try {
      const key = `${method}:${url}`;
      const httpMetric = this.httpMetrics[key];
      
      if (httpMetric) {
        await httpMetric.start();
      }
    } catch (error) {
      console.error('Error starting HTTP metric:', error);
    }
  }

  /**
   * Stop HTTP metric and record results
   * 
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   * @param {number} responseCode - HTTP response code
   * @param {number} responseSize - Response size in bytes
   * @param {Object} attributes - Additional attributes
   */
  async stopHttpMetric(url, method, responseCode, responseSize, attributes = {}) {
    try {
      const key = `${method}:${url}`;
      const httpMetric = this.httpMetrics[key];
      
      if (httpMetric) {
        // Set response data
        httpMetric.setHttpResponseCode(responseCode);
        if (responseSize) {
          httpMetric.setResponseContentType('application/json');
          httpMetric.setResponsePayloadSize(responseSize);
        }
        
        // Add attributes
        for (const [key, value] of Object.entries(attributes)) {
          await httpMetric.putAttribute(key, String(value));
        }
        
        // Stop and record the metric
        await httpMetric.stop();
        delete this.httpMetrics[key];
      }
    } catch (error) {
      console.error('Error stopping HTTP metric:', error);
    }
  }

  /**
   * Trace a function execution
   * 
   * @param {string} traceName - Trace name
   * @param {Function} fn - Function to trace
   * @param {Object} attributes - Trace attributes
   * @returns {*} Function result
   */
  async traceFunction(traceName, fn, attributes = {}) {
    await this.startTrace(traceName);
    
    try {
      const result = await fn();
      await this.stopTrace(traceName, {
        ...attributes,
        success: 'true',
      });
      return result;
    } catch (error) {
      await this.stopTrace(traceName, {
        ...attributes,
        success: 'false',
        error: error.message,
      });
      throw error;
    }
  }
}

// Create and export singleton instance
export const Performance = new PerformanceService();

/**
 * Higher-order component for tracking screen views
 * 
 * @param {string} screenName - Screen name
 * @param {React.Component} WrappedComponent - Component to wrap
 * @returns {React.Component} Wrapped component with analytics
 */
export const withScreenTracking = (screenName, WrappedComponent) => {
  return class ScreenTracker extends React.Component {
    componentDidMount() {
      Analytics.logScreenView(screenName);
    }
    
    render() {
      return <WrappedComponent {...this.props} />;
    }
  };
};

/**
 * Configure error tracking for the app
 */
export const configureErrorTracking = () => {
  // Set user in crashlytics when auth state changes
  const { auth } = require('@react-native-firebase/auth');
  auth().onAuthStateChanged(user => {
    if (user) {
      crashlytics().setUserId(user.uid);
    } else {
      crashlytics().setUserId('');
    }
  });
  
  // Log JavaScript errors to crashlytics
  const originalErrorHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Log to crashlytics
    crashlytics().recordError(error);
    
    // Call original handler
    originalErrorHandler(error, isFatal);
  });
  
  // Log redux actions in development
  if (__DEV__) {
    const { createLogger } = require('redux-logger');
    return createLogger({
      collapsed: true,
      duration: true,
    });
  }
  
  return null;
};

/**
 * Initialize all monitoring services
 */
export const initializeMonitoring = () => {
  // Enable collection based on user consent
  analytics().setAnalyticsCollectionEnabled(true);
  perf().setPerformanceCollectionEnabled(true);
  
  // Set user in crashlytics when auth state changes
  const { auth } = require('@react-native-firebase/auth');
  auth().onAuthStateChanged(user => {
    if (user) {
      crashlytics().setUserId(user.uid);
    } else {
      crashlytics().setUserId('');
    }
  });
  
  // Log app open
  analytics().logAppOpen();
  
  // Log device info
  crashlytics().setAttributes({
    platform: Platform.OS,
    platformVersion: Platform.Version.toString(),
    device: Platform.constants.Model || 'unknown',
  });
  
  // Initialize performance monitoring
  if (Platform.OS === 'android') {
    perf().setPerformanceCollectionEnabled(true);
  }
};

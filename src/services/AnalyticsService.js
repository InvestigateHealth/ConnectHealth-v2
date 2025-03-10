// src/services/AnalyticsService.js
// Enhanced Analytics Service with more robust error handling and performance monitoring

import Config from 'react-native-config';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

// Import your actual analytics providers
// This is a placeholder implementation

class AnalyticsServiceClass {
  constructor() {
    this.initialized = false;
    this.userId = null;
    this.sessionId = null;
    this.deviceInfo = {};
    this.queue = [];
    this.processingQueue = false;
    this.errorSamplingRate = parseFloat(Config.ERROR_SAMPLING_RATE || '1.0');
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Collect device info for better analytics context
      this.deviceInfo = {
        appVersion: await DeviceInfo.getVersion(),
        buildNumber: await DeviceInfo.getBuildNumber(),
        deviceId: await DeviceInfo.getUniqueId(),
        deviceModel: await DeviceInfo.getModel(),
        osVersion: await DeviceInfo.getSystemVersion(),
        platform: Platform.OS,
        brand: await DeviceInfo.getBrand(),
      };
      
      // Generate a unique session ID
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Initialize your actual analytics providers
      if (Config.AMPLITUDE_API_KEY) {
        // Initialize Amplitude or other providers
        console.log('Analytics initialized with Amplitude');
      }
      
      this.initialized = true;
      
      // Process any queued events
      this.processQueue();
      
      // Log initialization success
      this.logEvent('analytics_initialized', {
        success: true,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
      // We can't use logEvent here as it might cause a loop
    }
  }
  
  async identifyUser(userId) {
    if (!userId) return;
    
    try {
      this.userId = userId;
      
      // Identify with your actual analytics providers
      if (Config.AMPLITUDE_API_KEY) {
        // e.g., Amplitude.setUserId(userId);
        console.log(`User identified: ${userId}`);
      }
      
      // Process any queued events now that we have user ID
      this.processQueue();
    } catch (error) {
      console.error('Error identifying user:', error);
    }
  }
  
  resetUser() {
    this.userId = null;
    
    // Reset user in your actual analytics providers
    if (Config.AMPLITUDE_API_KEY) {
      // e.g., Amplitude.setUserId(null);
      console.log('User reset');
    }
  }
  
  async logEvent(eventName, properties = {}) {
    if (!eventName) return;
    
    // Add standard properties to all events
    const enrichedProperties = {
      ...properties,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      deviceInfo: this.deviceInfo,
      // Add additional context that might be useful
      appState: {
        // You could add app-specific state here
      }
    };
    
    // If not initialized, queue the event
    if (!this.initialized) {
      this.queue.push({ eventName, properties: enrichedProperties });
      this.initialize(); // Try to initialize
      return;
    }
    
    try {
      // Log with your actual analytics providers
      if (Config.AMPLITUDE_API_KEY) {
        // e.g., Amplitude.logEvent(eventName, enrichedProperties);
        console.log(`Event logged: ${eventName}`, enrichedProperties);
      }
    } catch (error) {
      console.error(`Error logging event ${eventName}:`, error);
      this.queue.push({ eventName, properties: enrichedProperties });
    }
  }
  
  logError(error, contextData = {}) {
    // Only log a sample of errors if configured to do so
    if (Math.random() > this.errorSamplingRate) {
      return;
    }
    
    const errorData = {
      message: error.message || error.toString(),
      stack: error.stack,
      ...contextData,
      timestamp: Date.now()
    };
    
    this.logEvent('error_occurred', errorData);
  }
  
  // Performance tracking methods
  startTrackingPerformance(operationName) {
    return {
      name: operationName,
      startTime: performance.now()
    };
  }
  
  stopTrackingPerformance(tracker) {
    if (!tracker || !tracker.name) return;
    
    const duration = performance.now() - tracker.startTime;
    this.logEvent('performance', {
      operation: tracker.name,
      durationMs: Math.round(duration),
    });
    
    return duration;
  }
  
  // Process queued events
  async processQueue() {
    if (this.processingQueue || this.queue.length === 0 || !this.initialized) {
      return;
    }
    
    this.processingQueue = true;
    
    try {
      // Process all queued events
      const queueCopy = [...this.queue];
      this.queue = [];
      
      for (const item of queueCopy) {
        await this.logEvent(item.eventName, item.properties);
      }
    } catch (error) {
      console.error('Error processing analytics queue:', error);
    } finally {
      this.processingQueue = false;
      
      // If new items were added to the queue during processing, process again
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }
}

export const AnalyticsService = new AnalyticsServiceClass();

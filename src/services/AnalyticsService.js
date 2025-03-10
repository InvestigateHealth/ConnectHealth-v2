// src/services/AnalyticsService.js
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';
import Config from 'react-native-config';

/**
 * Analytics Service to track user events and interactions
 */
class AnalyticsService {
  constructor() {
    this.userId = null;
    this.sessionId = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.cachedEvents = [];
    this.isInitialized = false;
    this.deviceInfo = {};
    
    // Initialize the service
    this.initialize();
  }
  
  /**
   * Initialize analytics service with device information
   */
  async initialize() {
    try {
      this.deviceInfo = {
        appVersion: await DeviceInfo.getVersion(),
        buildNumber: await DeviceInfo.getBuildNumber(),
        deviceModel: await DeviceInfo.getModel(),
        systemName: await DeviceInfo.getSystemName(),
        systemVersion: await DeviceInfo.getSystemVersion(),
        isTablet: await DeviceInfo.isTablet(),
      };
      
      // Try to load any cached events that haven't been sent yet
      const cachedEvents = await AsyncStorage.getItem('cached_analytics_events');
      if (cachedEvents) {
        this.cachedEvents = JSON.parse(cachedEvents);
        this.trySendingCachedEvents();
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing analytics service:', error);
    }
  }
  
  /**
   * Identify the current user
   * @param {string} userId - User identifier
   */
  identifyUser(userId) {
    this.userId = userId;
    
    // Try to send any cached events now that we have a user ID
    if (this.cachedEvents.length > 0) {
      this.trySendingCachedEvents();
    }
  }
  
  /**
   * Reset user identification (e.g., on logout)
   */
  resetUser() {
    this.userId = null;
    this.sessionId = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }
  
  /**
   * Log an event with the analytics service
   * @param {string} eventName - Name of the event to log
   * @param {Object} params - Additional event parameters
   */
  async logEvent(eventName, params = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const eventData = {
      eventName,
      timestamp: new Date().toISOString(),
      userId: this.userId,
      sessionId: this.sessionId,
      deviceInfo: this.deviceInfo,
      params,
    };
    
    // Check if we can send this event immediately
    const networkState = await NetInfo.fetch();
    
    if (networkState.isConnected && !Config.FORCE_OFFLINE_ANALYTICS) {
      try {
        await this.sendEvent(eventData);
      } catch (error) {
        console.error('Error sending analytics event:', error);
        // Cache the event for later if sending fails
        this.cacheEvent(eventData);
      }
    } else {
      // Cache the event for later sending
      this.cacheEvent(eventData);
    }
  }
  
  /**
   * Cache an event for later sending
   * @param {Object} eventData - Event data to cache
   */
  async cacheEvent(eventData) {
    try {
      this.cachedEvents.push(eventData);
      
      // Limit the cache size to prevent it from growing too large
      if (this.cachedEvents.length > 500) {
        this.cachedEvents = this.cachedEvents.slice(-500);
      }
      
      await AsyncStorage.setItem('cached_analytics_events', JSON.stringify(this.cachedEvents));
    } catch (error) {
      console.error('Error caching analytics event:', error);
    }
  }
  
  /**
   * Send an event to the analytics backend
   * @param {Object} eventData - Event data to send
   */
  async sendEvent(eventData) {
    if (!eventData) return;
    
    try {
      await firestore().collection('analytics').add({
        ...eventData,
        serverTimestamp: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error sending analytics event to Firestore:', error);
      throw error;
    }
  }
  
  /**
   * Try to send any cached events
   */
  async trySendingCachedEvents() {
    if (this.cachedEvents.length === 0) return;
    
    const networkState = await NetInfo.fetch();
    
    if (!networkState.isConnected) return;
    
    const eventsToSend = [...this.cachedEvents];
    this.cachedEvents = [];
    
    // Update the cache immediately
    await AsyncStorage.setItem('cached_analytics_events', JSON.stringify(this.cachedEvents));
    
    // Send events in batches to avoid overwhelming the network
    const batchSize = 20;
    for (let i = 0; i < eventsToSend.length; i += batchSize) {
      const batch = eventsToSend.slice(i, i + batchSize);
      
      try {
        // Use a batched write for efficiency
        const batch = firestore().batch();
        
        batch.forEach(eventData => {
          // Update the user ID if it was missing before
          if (!eventData.userId && this.userId) {
            eventData.userId = this.userId;
          }
          
          const docRef = firestore().collection('analytics').doc();
          batch.set(docRef, {
            ...eventData,
            serverTimestamp: firestore.FieldValue.serverTimestamp(),
          });
        });
        
        await batch.commit();
      } catch (error) {
        console.error('Error sending cached analytics events:', error);
        
        // Re-cache the events that failed to send
        this.cachedEvents = [...this.cachedEvents, ...batch];
        await AsyncStorage.setItem('cached_analytics_events', JSON.stringify(this.cachedEvents));
        
        // Stop trying to send more events for now
        break;
      }
    }
  }
}

// Create a singleton instance
export const AnalyticsService = new AnalyticsService();

// src/services/ActivityService.js
// Service for tracking user activity and online status

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Analytics } from './AnalyticsService';

/**
 * Activity Service
 * 
 * Handles tracking user activity, online status, and session information
 */
class ActivityServiceClass {
  constructor() {
    this.isInitialized = false;
    this.lastUpdateTime = null;
    this.updateInterval = null;
    this.networkListener = null;
    this.isOnline = true;
    this.updateIntervalTime = 5 * 60 * 1000; // 5 minutes
    this.activityTimeout = 15 * 60 * 1000; // 15 minutes
    this.userId = null;
  }

  /**
   * Initialize the activity service for a user
   * 
   * @param {string} userId - User ID to track
   */
  init(userId) {
    if (this.isInitialized && this.userId === userId) return;
    
    this.userId = userId;
    this.setupNetworkListener();
    this.setupActivityTracking();
    this.isInitialized = true;
    
    // Log initial session start
    this.logSessionStart();
  }

  /**
   * Clean up resources when user signs out
   */
  cleanup() {
    // Clear update interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Remove network listener
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }
    
    // Log session end
    if (this.userId) {
      this.logSessionEnd();
    }
    
    this.isInitialized = false;
    this.userId = null;
  }

  /**
   * Set up network connectivity monitoring
   */
  setupNetworkListener() {
    // Listen for network changes
    this.networkListener = NetInfo.addEventListener(state => {
      const prevOnlineState = this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      // If network state changed, update status
      if (prevOnlineState !== this.isOnline && this.userId) {
        this.updateOnlineStatus(this.isOnline);
      }
    });
    
    // Initial check
    NetInfo.fetch().then(state => {
      this.isOnline = state.isConnected && state.isInternetReachable;
      if (this.userId) {
        this.updateOnlineStatus(this.isOnline);
      }
    });
  }

  /**
   * Set up periodic activity tracking
   */
  setupActivityTracking() {
    // Update activity immediately
    this.updateActivity();
    
    // Set up interval for periodic updates
    this.updateInterval = setInterval(() => {
      this.updateActivity();
    }, this.updateIntervalTime);
  }

  /**
   * Update user's activity timestamp
   */
  updateActivity() {
    if (!this.userId || !this.isOnline) return;
    
    // Don't update if last update was too recent (throttle)
    const now = Date.now();
    if (this.lastUpdateTime && now - this.lastUpdateTime < 60000) {
      return;
    }
    
    this.lastUpdateTime = now;
    
    // Update last active timestamp in Firestore
    firestore().collection('users').doc(this.userId).update({
      lastActive: firestore.FieldValue.serverTimestamp(),
      lastActiveDevice: this.getDeviceInfo()
    }).catch(error => {
      console.error('Error updating activity timestamp:', error);
    });
  }

  /**
   * Update user's online status
   * 
   * @param {boolean} isOnline - Whether user is online
   */
  updateOnlineStatus(isOnline) {
    if (!this.userId) return;
    
    firestore().collection('users').doc(this.userId).update({
      isOnline: isOnline,
      lastOnlineChange: firestore.FieldValue.serverTimestamp()
    }).catch(error => {
      console.error('Error updating online status:', error);
    });
    
    // Log analytics event for significant status changes
    Analytics.logEvent('online_status_change', {
      user_id: this.userId,
      status: isOnline ? 'online' : 'offline',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log a session start event
   */
  logSessionStart() {
    if (!this.userId) return;
    
    // Add session to Firestore
    firestore().collection('userSessions').add({
      userId: this.userId,
      startTime: firestore.FieldValue.serverTimestamp(),
      device: this.getDeviceInfo(),
      active: true
    }).then(docRef => {
      // Store session ID for later reference
      this.currentSessionId = docRef.id;
      
      // Log analytics event
      Analytics.logEvent('session_start', {
        user_id: this.userId,
        session_id: this.currentSessionId,
        device: Platform.OS,
        timestamp: new Date().toISOString()
      });
    }).catch(error => {
      console.error('Error logging session start:', error);
    });
  }

  /**
   * Log a session end event
   */
  logSessionEnd() {
    if (!this.userId || !this.currentSessionId) return;
    
    // Update session in Firestore
    firestore().collection('userSessions').doc(this.currentSessionId).update({
      endTime: firestore.FieldValue.serverTimestamp(),
      active: false
    }).catch(error => {
      console.error('Error logging session end:', error);
    });
    
    // Log analytics event
    Analytics.logEvent('session_end', {
      user_id: this.userId,
      session_id: this.currentSessionId,
      device: Platform.OS,
      timestamp: new Date().toISOString()
    });
    
    this.currentSessionId = null;
  }

  /**
   * Get device information
   * 
   * @returns {Object} Device info
   */
  getDeviceInfo() {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      brand: Platform.OS === 'android' ? 'Android Device' : 'iOS Device',
      model: Platform.OS === 'android' ? 'Android' : 'iOS'
    };
  }

  /**
   * Track a specific user action
   * 
   * @param {string} actionType - Type of action
   * @param {Object} data - Additional action data
   */
  trackUserAction(actionType, data = {}) {
    if (!this.userId) return;
    
    const actionData = {
      userId: this.userId,
      actionType,
      timestamp: firestore.FieldValue.serverTimestamp(),
      ...data
    };
    
    // Log to Firestore
    firestore().collection('userActions').add(actionData)
      .catch(error => {
        console.error('Error tracking user action:', error);
      });
    
    // Log analytics event
    Analytics.logEvent('user_action', {
      user_id: this.userId,
      action_type: actionType,
      ...data,
      timestamp: new Date().toISOString()
    });
    
    // Update last activity timestamp
    this.updateActivity();
  }
}

// Create singleton instance
export const ActivityService = new ActivityServiceClass();

// Export function to easily update activity from anywhere
export const updateUserActivity = (userId = null) => {
  // Use provided userId or get current user
  const currentUserId = userId || auth().currentUser?.uid;
  
  if (currentUserId) {
    // Initialize service if needed
    if (!ActivityService.isInitialized || ActivityService.userId !== currentUserId) {
      ActivityService.init(currentUserId);
    } else {
      // Just update activity
      ActivityService.updateActivity();
    }
    return true;
  }
  
  return false;
};

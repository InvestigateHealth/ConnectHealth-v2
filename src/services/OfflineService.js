// src/services/OfflineService.js
// Offline queue and sync functionality with improved reliability and state management

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import uuid from 'react-native-uuid';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setOfflineStatus } from '../redux/slices/networkSlice';
import { withRetry } from './RetryService';
import { Analytics } from './AnalyticsService';

// Queue keys for different operations
const QUEUE_KEYS = {
  POST: 'offline_queue_posts',
  COMMENT: 'offline_queue_comments',
  LIKE: 'offline_queue_likes',
  PROFILE: 'offline_queue_profile',
};

// Operation types
const OPERATION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
};

/**
 * Offline Queue Service
 * 
 * Manages queuing operations when offline and syncing when back online
 */
class OfflineQueueService {
  constructor() {
    this.isInitialized = false;
    this.isOnline = true;
    this.networkListener = null;
    this.syncInProgress = false;
    
    // Queue state
    this.queues = {
      [QUEUE_KEYS.POST]: [],
      [QUEUE_KEYS.COMMENT]: [],
      [QUEUE_KEYS.LIKE]: [],
      [QUEUE_KEYS.PROFILE]: [],
    };
    
    // Callback registrations for sync events
    this.syncCallbacks = {
      onSyncStart: [],
      onSyncComplete: [],
      onSyncError: [],
    };
  }

  /**
   * Initialize the offline queue service
   */
  async init() {
    if (this.isInitialized) return;

    try {
      // Load all queues from storage
      await Promise.all([
        this.loadQueue(QUEUE_KEYS.POST),
        this.loadQueue(QUEUE_KEYS.COMMENT),
        this.loadQueue(QUEUE_KEYS.LIKE),
        this.loadQueue(QUEUE_KEYS.PROFILE),
      ]);
      
      // Listen for network changes
      this.networkListener = NetInfo.addEventListener(state => {
        const prevOnlineState = this.isOnline;
        this.isOnline = state.isConnected && state.isInternetReachable;

        // If we've come back online, try to sync the queues
        if (!prevOnlineState && this.isOnline) {
          this.syncQueues();
        }
      });

      // Initial check
      const netInfo = await NetInfo.fetch();
      this.isOnline = netInfo.isConnected && netInfo.isInternetReachable !== false;
      
      this.isInitialized = true;
      
      // If we're online on init and have pending operations, sync them
      if (this.isOnline && this.hasPendingOperations()) {
        this.syncQueues();
      }
    } catch (error) {
      console.error('Error initializing OfflineQueueService:', error);
    }
  }

  /**
   * Load a queue from AsyncStorage
   * 
   * @param {string} queueKey - Queue key to load
   */
  async loadQueue(queueKey) {
    try {
      const queueJson = await AsyncStorage.getItem(queueKey);
      
      if (queueJson) {
        const queueData = JSON.parse(queueJson);
        
        // Validate queue data
        if (Array.isArray(queueData)) {
          this.queues[queueKey] = queueData;
        } else {
          this.queues[queueKey] = [];
        }
      } else {
        this.queues[queueKey] = [];
      }
    } catch (error) {
      console.error(`Error loading queue ${queueKey}:`, error);
      this.queues[queueKey] = [];
    }
  }

  /**
   * Save a queue to AsyncStorage
   * 
   * @param {string} queueKey - Queue key to save
   */
  async saveQueue(queueKey) {
    try {
      const queue = this.queues[queueKey];
      await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
    } catch (error) {
      console.error(`Error saving queue ${queueKey}:`, error);
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }
    
    this.isInitialized = false;
    this.syncCallbacks = {
      onSyncStart: [],
      onSyncComplete: [],
      onSyncError: [],
    };
  }

  /**
   * Register callback for sync events
   * 
   * @param {string} event - Event type ('start', 'complete', 'error')
   * @param {Function} callback - Callback function
   * @returns {Function} Function to unregister callback
   */
  registerSyncCallback(event, callback) {
    if (!callback || typeof callback !== 'function') {
      return () => {};
    }
    
    const eventKey = `onSync${event.charAt(0).toUpperCase() + event.slice(1)}`;
    
    if (!this.syncCallbacks[eventKey]) {
      return () => {};
    }
    
    this.syncCallbacks[eventKey].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.syncCallbacks[eventKey] = this.syncCallbacks[eventKey].filter(cb => cb !== callback);
    };
  }

  /**
   * Trigger sync callbacks
   * 
   * @param {string} event - Event type ('start', 'complete', 'error')
   * @param {*} data - Event data
   */
  triggerSyncCallbacks(event, data) {
    const eventKey = `onSync${event.charAt(0).toUpperCase() + event.slice(1)}`;
    
    if (!this.syncCallbacks[eventKey]) {
      return;
    }
    
    for (const callback of this.syncCallbacks[eventKey]) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in sync ${event} callback:`, error);
      }
    }
  }

  /**
   * Add a post operation to the queue
   * 
   * @param {string} type - Operation type (create, update, delete)
   * @param {Object} data - Post data
   * @returns {Promise<string>} Temporary or actual post ID
   */
  async queuePostOperation(type, data) {
    const { PostService } = await import('../services/FirebaseService');
    
    // Generate a temporary ID for new posts
    const tempId = type === OPERATION_TYPES.CREATE 
      ? `temp_${uuid.v4()}` 
      : data.id;
    
    // If online, try to perform the operation directly
    if (this.isOnline) {
      try {
        switch (type) {
          case OPERATION_TYPES.CREATE:
            const postId = await PostService.createPost(data);
            return postId;
          case OPERATION_TYPES.UPDATE:
            await PostService.updatePost(data.id, data);
            return data.id;
          case OPERATION_TYPES.DELETE:
            await PostService.deletePost(data.id);
            return data.id;
          default:
            throw new Error('Unknown operation type');
        }
      } catch (error) {
        console.error('Error performing post operation:', error);
        // If operation fails, add to queue
      }
    }
    
    // For offline or failed operations, add to queue
    try {
      // Get existing queue
      const queue = [...this.queues[QUEUE_KEYS.POST]];
      
      // Add operation to queue
      queue.push({
        id: tempId,
        type,
        data: {
          ...data,
          id: tempId,
          createdAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      });
      
      // Update queue and save
      this.queues[QUEUE_KEYS.POST] = queue;
      await this.saveQueue(QUEUE_KEYS.POST);
      
      // Track queued operation in analytics
      Analytics.logEvent('offline_operation_queued', {
        operation_type: 'post',
        action_type: type
      });
      
      return tempId;
    } catch (error) {
      console.error('Error adding to post queue:', error);
      throw error;
    }
  }

  /**
   * Add a comment operation to the queue
   * 
   * @param {string} type - Operation type (create, update, delete)
   * @param {Object} data - Comment data
   * @returns {Promise<string>} Temporary or actual comment ID
   */
  async queueCommentOperation(type, data) {
    const { CommentService } = await import('../services/FirebaseService');
    
    // Generate a temporary ID for new comments
    const tempId = type === OPERATION_TYPES.CREATE 
      ? `temp_${uuid.v4()}` 
      : data.id;
    
    // If online, try to perform the operation directly
    if (this.isOnline) {
      try {
        switch (type) {
          case OPERATION_TYPES.CREATE:
            const commentId = await CommentService.addComment(data);
            return commentId;
          case OPERATION_TYPES.UPDATE:
            await CommentService.updateComment(data.id, data.text);
            return data.id;
          case OPERATION_TYPES.DELETE:
            await CommentService.deleteComment(data.id, data.postId);
            return data.id;
          default:
            throw new Error('Unknown operation type');
        }
      } catch (error) {
        console.error('Error performing comment operation:', error);
        // If operation fails, add to queue
      }
    }
    
    // For offline or failed operations, add to queue
    try {
      // Get existing queue
      const queue = [...this.queues[QUEUE_KEYS.COMMENT]];
      
      // Add operation to queue
      queue.push({
        id: tempId,
        type,
        data: {
          ...data,
          id: tempId,
          createdAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      });
      
      // Update queue and save
      this.queues[QUEUE_KEYS.COMMENT] = queue;
      await this.saveQueue(QUEUE_KEYS.COMMENT);
      
      // Track queued operation in analytics
      Analytics.logEvent('offline_operation_queued', {
        operation_type: 'comment',
        action_type: type
      });
      
      return tempId;
    } catch (error) {
      console.error('Error adding to comment queue:', error);
      throw error;
    }
  }
  
  /**
   * Add a like operation to the queue
   * 
   * @param {Object} data - Like data (postId, userId)
   * @returns {Promise<boolean>} Success status
   */
  async queueLikeOperation(data) {
    const { PostService } = await import('../services/FirebaseService');
    
    // If online, try to perform the operation directly
    if (this.isOnline) {
      try {
        const isLiked = await PostService.toggleLike(data.postId, data.userId);
        return isLiked;
      } catch (error) {
        console.error('Error performing like operation:', error);
        // If operation fails, add to queue
      }
    }
    
    // For offline or failed operations, add to queue
    try {
      // Get existing queue
      const queue = [...this.queues[QUEUE_KEYS.LIKE]];
      
      // Add operation to queue
      queue.push({
        id: `${data.postId}_${data.userId}`,
        data,
        createdAt: new Date().toISOString(),
      });
      
      // Update queue and save
      this.queues[QUEUE_KEYS.LIKE] = queue;
      await this.saveQueue(QUEUE_KEYS.LIKE);
      
      // Track queued operation in analytics
      Analytics.logEvent('offline_operation_queued', {
        operation_type: 'like'
      });
      
      // Return optimistic result for UI
      return true;
    } catch (error) {
      console.error('Error adding to like queue:', error);
      throw error;
    }
  }

  /**
   * Add a profile update operation to the queue
   * 
   * @param {string} userId - User ID
   * @param {Object} data - Profile data to update
   * @returns {Promise<boolean>} Success status
   */
  async queueProfileUpdate(userId, data) {
    const { UserService } = await import('../services/FirebaseService');
    
    // If online, try to perform the operation directly
    if (this.isOnline) {
      try {
        await UserService.updateProfile(userId, data);
        return true;
      } catch (error) {
        console.error('Error performing profile update:', error);
        // If operation fails, add to queue
      }
    }
    
    // For offline or failed operations, add to queue
    try {
      // Get existing queue
      const queue = [...this.queues[QUEUE_KEYS.PROFILE]];
      
      // Add operation to queue
      queue.push({
        id: userId,
        data,
        createdAt: new Date().toISOString(),
      });
      
      // Update queue and save
      this.queues[QUEUE_KEYS.PROFILE] = queue;
      await this.saveQueue(QUEUE_KEYS.PROFILE);
      
      // Track queued operation in analytics
      Analytics.logEvent('offline_operation_queued', {
        operation_type: 'profile'
      });
      
      return true;
    } catch (error) {
      console.error('Error adding to profile queue:', error);
      throw error;
    }
  }

  /**
   * Sync all queued operations when back online
   * 
   * @returns {Promise<void>}
   */
  async syncQueues() {
    if (!this.isOnline || this.syncInProgress) return;
    
    this.syncInProgress = true;
    this.triggerSyncCallbacks('start', null);
    
    try {
      const { FirebaseService } = await import('../services/FirebaseService');
      
      // Track sync start in analytics
      Analytics.logEvent('offline_sync_started', {
        posts_count: this.queues[QUEUE_KEYS.POST].length,
        comments_count: this.queues[QUEUE_KEYS.COMMENT].length,
        likes_count: this.queues[QUEUE_KEYS.LIKE].length,
        profile_count: this.queues[QUEUE_KEYS.PROFILE].length
      });
      
      // Sync posts first
      await this.syncQueue(QUEUE_KEYS.POST, async (operation) => {
        switch (operation.type) {
          case OPERATION_TYPES.CREATE:
            const postId = await FirebaseService.PostService.createPost({
              ...operation.data,
              offlineCreated: true
            });
            // Update IDs in other queues (comments, likes) that reference this temporary ID
            await this.updateReferencesInQueues(operation.id, postId);
            return postId;
          case OPERATION_TYPES.UPDATE:
            // Check if this is a temporary ID or real ID
            if (operation.data.id.startsWith('temp_')) {
              console.warn('Skipping update on unsaved post:', operation.data.id);
              return operation.data.id;
            }
            await FirebaseService.PostService.updatePost(operation.data.id, operation.data);
            return operation.data.id;
          case OPERATION_TYPES.DELETE:
            // Check if this is a temporary ID (which wouldn't exist on server)
            if (operation.data.id.startsWith('temp_')) {
              console.warn('Skipping delete on unsaved post:', operation.data.id);
              return operation.data.id;
            }
            await FirebaseService.PostService.deletePost(operation.data.id);
            return operation.data.id;
        }
      });
      
      // Sync comments
      await this.syncQueue(QUEUE_KEYS.COMMENT, async (operation) => {
        switch (operation.type) {
          case OPERATION_TYPES.CREATE:
            // Check if the post ID is a temporary ID that hasn't been synced
            const postId = operation.data.postId;
            if (postId.startsWith('temp_')) {
              // Keep in queue and try again later
              throw new Error(`Post ${postId} not yet synced`);
            }
            const commentId = await FirebaseService.CommentService.addComment(operation.data);
            return commentId;
          case OPERATION_TYPES.UPDATE:
            // Skip updates on temporary comments
            if (operation.data.id.startsWith('temp_')) {
              console.warn('Skipping update on unsaved comment:', operation.data.id);
              return operation.data.id;
            }
            await FirebaseService.CommentService.updateComment(operation.data.id, operation.data.text);
            return operation.data.id;
          case OPERATION_TYPES.DELETE:
            // Skip deletes on temporary comments
            if (operation.data.id.startsWith('temp_')) {
              console.warn('Skipping delete on unsaved comment:', operation.data.id);
              return operation.data.id;
            }
            await FirebaseService.CommentService.deleteComment(operation.data.id, operation.data.postId);
            return operation.data.id;
        }
      });
      
      // Sync likes
      await this.syncQueue(QUEUE_KEYS.LIKE, async (operation) => {
        // Skip likes on temporary posts
        if (operation.data.postId.startsWith('temp_')) {
          console.warn('Skipping like on unsaved post:', operation.data.postId);
          return operation.id;
        }
        await FirebaseService.PostService.toggleLike(operation.data.postId, operation.data.userId);
        return operation.id;
      });
      
      // Sync profile updates
      await this.syncQueue(QUEUE_KEYS.PROFILE, async (operation) => {
        await FirebaseService.UserService.updateProfile(operation.id, operation.data);
        return operation.id;
      });
      
      // Track sync completion in analytics
      Analytics.logEvent('offline_sync_completed', {
        success: true
      });
      
      this.triggerSyncCallbacks('complete', {
        success: true
      });
    } catch (error) {
      console.error('Error syncing queues:', error);
      
      // Track sync error in analytics
      Analytics.logEvent('offline_sync_error', {
        error: error.message
      });
      
      this.triggerSyncCallbacks('error', {
        error: error.message
      });
    } finally {
      this.syncInProgress = false;
    }
  }
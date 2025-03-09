// src/services/OfflineService.js
// Offline queue and sync functionality

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import uuid from 'react-native-uuid';
import { store } from '../redux/store';

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
  }

  /**
   * Initialize the offline queue service
   */
  init() {
    if (this.isInitialized) return;

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
    NetInfo.fetch().then(state => {
      this.isOnline = state.isConnected && state.isInternetReachable;
    });

    this.isInitialized = true;
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
  }

  /**
   * Add a post operation to the queue
   * 
   * @param {string} type - Operation type (create, update, delete)
   * @param {Object} data - Post data
   * @returns {Promise<string>} Temporary or actual post ID
   */
  async queuePostOperation(type, data) {
    const { FirebaseService } = await import('./FirebaseService');
    
    // Generate a temporary ID for new posts
    const tempId = type === OPERATION_TYPES.CREATE 
      ? `temp_${uuid.v4()}` 
      : data.id;
    
    // If online, try to perform the operation directly
    if (this.isOnline) {
      try {
        switch (type) {
          case OPERATION_TYPES.CREATE:
            const postId = await FirebaseService.PostService.createPost(data);
            return postId;
          case OPERATION_TYPES.UPDATE:
            await FirebaseService.PostService.updatePost(data.id, data);
            return data.id;
          case OPERATION_TYPES.DELETE:
            await FirebaseService.PostService.deletePost(data.id);
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
      const queueString = await AsyncStorage.getItem(QUEUE_KEYS.POST);
      const queue = queueString ? JSON.parse(queueString) : [];
      
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
      
      // Save updated queue
      await AsyncStorage.setItem(QUEUE_KEYS.POST, JSON.stringify(queue));
      
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
    const { FirebaseService } = await import('./FirebaseService');
    
    // Generate a temporary ID for new comments
    const tempId = type === OPERATION_TYPES.CREATE 
      ? `temp_${uuid.v4()}` 
      : data.id;
    
    // If online, try to perform the operation directly
    if (this.isOnline) {
      try {
        switch (type) {
          case OPERATION_TYPES.CREATE:
            const commentId = await FirebaseService.CommentService.addComment(data);
            return commentId;
          case OPERATION_TYPES.UPDATE:
            await FirebaseService.CommentService.updateComment(data.id, data.text);
            return data.id;
          case OPERATION_TYPES.DELETE:
            await FirebaseService.CommentService.deleteComment(data.id, data.postId);
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
      const queueString = await AsyncStorage.getItem(QUEUE_KEYS.COMMENT);
      const queue = queueString ? JSON.parse(queueString) : [];
      
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
      
      // Save updated queue
      await AsyncStorage.setItem(QUEUE_KEYS.COMMENT, JSON.stringify(queue));
      
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
    const { FirebaseService } = await import('./FirebaseService');
    
    // If online, try to perform the operation directly
    if (this.isOnline) {
      try {
        const isLiked = await FirebaseService.PostService.toggleLike(data.postId, data.userId);
        return isLiked;
      } catch (error) {
        console.error('Error performing like operation:', error);
        // If operation fails, add to queue
      }
    }
    
    // For offline or failed operations, add to queue
    try {
      // Get existing queue
      const queueString = await AsyncStorage.getItem(QUEUE_KEYS.LIKE);
      const queue = queueString ? JSON.parse(queueString) : [];
      
      // Add operation to queue
      queue.push({
        id: `${data.postId}_${data.userId}`,
        data,
        createdAt: new Date().toISOString(),
      });
      
      // Save updated queue
      await AsyncStorage.setItem(QUEUE_KEYS.LIKE, JSON.stringify(queue));
      
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
    const { FirebaseService } = await import('./FirebaseService');
    
    // If online, try to perform the operation directly
    if (this.isOnline) {
      try {
        await FirebaseService.UserService.updateProfile(userId, data);
        return true;
      } catch (error) {
        console.error('Error performing profile update:', error);
        // If operation fails, add to queue
      }
    }
    
    // For offline or failed operations, add to queue
    try {
      // Get existing queue
      const queueString = await AsyncStorage.getItem(QUEUE_KEYS.PROFILE);
      const queue = queueString ? JSON.parse(queueString) : [];
      
      // Add operation to queue
      queue.push({
        id: userId,
        data,
        createdAt: new Date().toISOString(),
      });
      
      // Save updated queue
      await AsyncStorage.setItem(QUEUE_KEYS.PROFILE, JSON.stringify(queue));
      
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
    
    try {
      const { FirebaseService } = await import('./FirebaseService');
      
      // Sync posts
      await this.syncQueue(QUEUE_KEYS.POST, async (operation) => {
        switch (operation.type) {
          case OPERATION_TYPES.CREATE:
            const postId = await FirebaseService.PostService.createPost(operation.data);
            // Update IDs in other queues (comments, likes) that reference this temporary ID
            await this.updateReferencesInQueues(operation.id, postId);
            return postId;
          case OPERATION_TYPES.UPDATE:
            await FirebaseService.PostService.updatePost(operation.data.id, operation.data);
            return operation.data.id;
          case OPERATION_TYPES.DELETE:
            await FirebaseService.PostService.deletePost(operation.data.id);
            return operation.data.id;
        }
      });
      
      // Sync comments
      await this.syncQueue(QUEUE_KEYS.COMMENT, async (operation) => {
        switch (operation.type) {
          case OPERATION_TYPES.CREATE:
            const commentId = await FirebaseService.CommentService.addComment(operation.data);
            return commentId;
          case OPERATION_TYPES.UPDATE:
            await FirebaseService.CommentService.updateComment(operation.data.id, operation.data.text);
            return operation.data.id;
          case OPERATION_TYPES.DELETE:
            await FirebaseService.CommentService.deleteComment(operation.data.id, operation.data.postId);
            return operation.data.id;
        }
      });
      
      // Sync likes
      await this.syncQueue(QUEUE_KEYS.LIKE, async (operation) => {
        await FirebaseService.PostService.toggleLike(operation.data.postId, operation.data.userId);
        return operation.id;
      });
      
      // Sync profile updates
      await this.syncQueue(QUEUE_KEYS.PROFILE, async (operation) => {
        await FirebaseService.UserService.updateProfile(operation.id, operation.data);
        return operation.id;
      });
      
    } catch (error) {
      console.error('Error syncing queues:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Helper method to sync a specific queue
   * 
   * @param {string} queueKey - Queue key to sync
   * @param {Function} processOperation - Function to process each operation
   * @returns {Promise<void>}
   */
  async syncQueue(queueKey, processOperation) {
    try {
      // Get queue
      const queueString = await AsyncStorage.getItem(queueKey);
      if (!queueString) return;
      
      const queue = JSON.parse(queueString);
      if (!queue.length) return;
      
      // Process operations in order they were added
      const failedOperations = [];
      
      for (const operation of queue) {
        try {
          await processOperation(operation);
        } catch (error) {
          console.error(`Failed to process operation ${operation.id}:`, error);
          failedOperations.push(operation);
        }
      }
      
      // Save failed operations back to queue
      await AsyncStorage.setItem(queueKey, JSON.stringify(failedOperations));
      
    } catch (error) {
      console.error(`Error syncing queue ${queueKey}:`, error);
    }
  }

  /**
   * Update references to temporary IDs in other queues
   * 
   * @param {string} tempId - Temporary ID
   * @param {string} realId - Real ID
   * @returns {Promise<void>}
   */
  async updateReferencesInQueues(tempId, realId) {
    try {
      // Update references in comment queue
      const commentQueueString = await AsyncStorage.getItem(QUEUE_KEYS.COMMENT);
      if (commentQueueString) {
        const commentQueue = JSON.parse(commentQueueString);
        let hasChanges = false;
        
        for (const operation of commentQueue) {
          if (operation.data.postId === tempId) {
            operation.data.postId = realId;
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          await AsyncStorage.setItem(QUEUE_KEYS.COMMENT, JSON.stringify(commentQueue));
        }
      }
      
      // Update references in like queue
      const likeQueueString = await AsyncStorage.getItem(QUEUE_KEYS.LIKE);
      if (likeQueueString) {
        const likeQueue = JSON.parse(likeQueueString);
        let hasChanges = false;
        
        for (const operation of likeQueue) {
          if (operation.data.postId === tempId) {
            operation.data.postId = realId;
            operation.id = `${realId}_${operation.data.userId}`;
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          await AsyncStorage.setItem(QUEUE_KEYS.LIKE, JSON.stringify(likeQueue));
        }
      }
    } catch (error) {
      console.error('Error updating references in queues:', error);
    }
  }

  /**
   * Get the current online status
   * 
   * @returns {boolean} Is online
   */
  isNetworkConnected() {
    return this.isOnline;
  }

  /**
   * Force a sync attempt
   * 
   * @returns {Promise<boolean>} Success status
   */
  async forceSyncQueues() {
    if (this.isOnline && !this.syncInProgress) {
      await this.syncQueues();
      return true;
    }
    return false;
  }

  /**
   * Check if there are any pending operations in the queues
   * 
   * @returns {Promise<boolean>} Has pending operations
   */
  async hasPendingOperations() {
    try {
      for (const key of Object.values(QUEUE_KEYS)) {
        const queueString = await AsyncStorage.getItem(key);
        if (queueString) {
          const queue = JSON.parse(queueString);
          if (queue.length > 0) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking pending operations:', error);
      return false;
    }
  }

  /**
   * Get counts of pending operations by type
   * 
   * @returns {Promise<Object>} Counts by queue type
   */
  async getPendingOperationCounts() {
    try {
      const counts = {};
      
      for (const key of Object.values(QUEUE_KEYS)) {
        const queueString = await AsyncStorage.getItem(key);
        if (queueString) {
          const queue = JSON.parse(queueString);
          counts[key] = queue.length;
        } else {
          counts[key] = 0;
        }
      }
      
      return counts;
    } catch (error) {
      console.error('Error getting pending operation counts:', error);
      return {};
    }
  }
}

// Create and export singleton instance
export const OfflineQueue = new OfflineQueueService();

// Local Storage Service for offline data persistence
export class LocalStorageService {
  static STORAGE_KEYS = {
    FEED_POSTS: 'offline_feed_posts',
    USER_POSTS: 'offline_user_posts',
    USER_PROFILE: 'offline_user_profile',
    COMMENTS: 'offline_comments',
    NOTIFICATIONS: 'offline_notifications',
    USER_DETAILS: 'offline_user_details',
    SETTINGS: 'offline_settings',
    BLOCKED_USERS: 'offline_blocked_users',
  };

  /**
   * Save feed posts to local storage
   * 
   * @param {Array} posts - Feed posts
   * @returns {Promise<void>}
   */
  static async saveFeedPosts(posts) {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.FEED_POSTS, JSON.stringify(posts));
    } catch (error) {
      console.error('Error saving feed posts:', error);
    }
  }

  /**
   * Get cached feed posts
   * 
   * @returns {Promise<Array>} Cached feed posts
   */
  static async getFeedPosts() {
    try {
      const postsString = await AsyncStorage.getItem(this.STORAGE_KEYS.FEED_POSTS);
      return postsString ? JSON.parse(postsString) : [];
    } catch (error) {
      console.error('Error getting feed posts:', error);
      return [];
    }
  }

  /**
   * Save user posts to local storage
   * 
   * @param {string} userId - User ID
   * @param {Array} posts - User posts
   * @returns {Promise<void>}
   */
  static async saveUserPosts(userId, posts) {
    try {
      // Get current user posts data
      const userPostsString = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_POSTS);
      const userPosts = userPostsString ? JSON.parse(userPostsString) : {};
      
      // Update posts for this user
      userPosts[userId] = posts;
      
      // Save back to storage
      await AsyncStorage.setItem(this.STORAGE_KEYS.USER_POSTS, JSON.stringify(userPosts));
    } catch (error) {
      console.error('Error saving user posts:', error);
    }
  }

  /**
   * Get cached user posts
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Cached user posts
   */
  static async getUserPosts(userId) {
    try {
      const userPostsString = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_POSTS);
      const userPosts = userPostsString ? JSON.parse(userPostsString) : {};
      return userPosts[userId] || [];
    } catch (error) {
      console.error('Error getting user posts:', error);
      return [];
    }
  }

  /**
   * Save user profile to local storage
   * 
   * @param {string} userId - User ID
   * @param {Object} profile - User profile data
   * @returns {Promise<void>}
   */
  static async saveUserProfile(userId, profile) {
    try {
      // Get current profiles
      const profilesString = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_PROFILE);
      const profiles = profilesString ? JSON.parse(profilesString) : {};
      
      // Update profile for this user
      profiles[userId] = {
        ...profile,
        lastUpdated: new Date().toISOString(),
      };
      
      // Save back to storage
      await AsyncStorage.setItem(this.STORAGE_KEYS.USER_PROFILE, JSON.stringify(profiles));
    } catch (error) {
      console.error('Error saving user profile:', error);
    }
  }

  /**
   * Get cached user profile
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Cached user profile
   */
  static async getUserProfile(userId) {
    try {
      const profilesString = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_PROFILE);
      const profiles = profilesString ? JSON.parse(profilesString) : {};
      return profiles[userId] || null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Save comments for a post to local storage
   * 
   * @param {string} postId - Post ID
   * @param {Array} comments - Post comments
   * @returns {Promise<void>}
   */
  static async saveComments(postId, comments) {
    try {
      // Get current comments
      const commentsString = await AsyncStorage.getItem(this.STORAGE_KEYS.COMMENTS);
      const allComments = commentsString ? JSON.parse(commentsString) : {};
      
      // Update comments for this post
      allComments[postId] = comments;
      
      // Save back to storage
      await AsyncStorage.setItem(this.STORAGE_KEYS.COMMENTS, JSON.stringify(allComments));
    } catch (error) {
      console.error('Error saving comments:', error);
    }
  }

  /**
   * Get cached comments for a post
   * 
   * @param {string} postId - Post ID
   * @returns {Promise<Array>} Cached comments
   */
  static async getComments(postId) {
    try {
      const commentsString = await AsyncStorage.getItem(this.STORAGE_KEYS.COMMENTS);
      const allComments = commentsString ? JSON.parse(commentsString) : {};
      return allComments[postId] || [];
    } catch (error) {
      console.error('Error getting comments:', error);
      return [];
    }
  }

  /**
   * Save notifications to local storage
   * 
   * @param {Array} notifications - User notifications
   * @returns {Promise<void>}
   */
  static async saveNotifications(notifications) {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }

  /**
   * Get cached notifications
   * 
   * @returns {Promise<Array>} Cached notifications
   */
  static async getNotifications() {
    try {
      const notificationsString = await AsyncStorage.getItem(this.STORAGE_KEYS.NOTIFICATIONS);
      return notificationsString ? JSON.parse(notificationsString) : [];
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  /**
   * Save blocked users to local storage
   * 
   * @param {Array} blockedUsers - Blocked user IDs
   * @returns {Promise<void>}
   */
  static async saveBlockedUsers(blockedUsers) {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(blockedUsers));
    } catch (error) {
      console.error('Error saving blocked users:', error);
    }
  }

  /**
   * Get cached blocked users
   * 
   * @returns {Promise<Array>} Cached blocked user IDs
   */
  static async getBlockedUsers() {
    try {
      const blockedUsersString = await AsyncStorage.getItem(this.STORAGE_KEYS.BLOCKED_USERS);
      return blockedUsersString ? JSON.parse(blockedUsersString) : [];
    } catch (error) {
      console.error('Error getting blocked users:', error);
      return [];
    }
  }

  /**
   * Save app settings to local storage
   * 
   * @param {Object} settings - App settings
   * @returns {Promise<void>}
   */
  static async saveSettings(settings) {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  /**
   * Get cached app settings
   * 
   * @returns {Promise<Object>} Cached app settings
   */
  static async getSettings() {
    try {
      const settingsString = await AsyncStorage.getItem(this.STORAGE_KEYS.SETTINGS);
      return settingsString ? JSON.parse(settingsString) : {};
    } catch (error) {
      console.error('Error getting settings:', error);
      return {};
    }
  }

  /**
   * Clear all cached data (used for logout)
   * 
   * @returns {Promise<void>}
   */
  static async clearAllData() {
    try {
      const keys = Object.values(this.STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }
}

/**
 * Custom hook for fetching data with offline support
 * 
 * @param {Function} fetchOnlineData - Function to fetch online data
 * @param {Function} getCachedData - Function to get cached data
 * @param {Function} cacheData - Function to cache data
 * @param {Array} dependencies - Dependencies for the effect
 * @returns {Object} { data, loading, error, refetch }
 */
export const useOfflineData = ({
  fetchOnlineData,
  getCachedData,
  cacheData,
  dependencies = [],
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isConnected } = useNetwork();
  const dispatch = useDispatch();

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // First try to get cached data
        const cachedData = await getCachedData();
        
        if (cachedData && isMounted) {
          setData(cachedData);
          setLoading(false);
        }
        
        // If online, fetch fresh data
        if (isConnected) {
          try {
            const freshData = await fetchOnlineData();
            
            if (isMounted) {
              setData(freshData);
              setLoading(false);
              
              // Cache the fresh data
              await cacheData(freshData);
            }
          } catch (onlineError) {
            console.error('Error fetching online data:', onlineError);
            
            if (isMounted && !cachedData) {
              setError(onlineError.message);
              setLoading(false);
            }
          }
        } else if (isMounted && !cachedData) {
          // If offline and no cached data
          setError('You are offline and no cached data is available.');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error in useOfflineData:', err);
        
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [isConnected, ...dependencies]);

  const refetch = async () => {
    if (!isConnected) {
      return { success: false, message: 'You are offline.' };
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const freshData = await fetchOnlineData();
      setData(freshData);
      
      // Cache the fresh data
      await cacheData(freshData);
      
      setLoading(false);
      return { success: true };
    } catch (err) {
      console.error('Error refetching data:', err);
      setError(err.message);
      setLoading(false);
      return { success: false, message: err.message };
    }
  };

  return { data, loading, error, refetch };
};

// Import at the top of the file
import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNetwork } from '../hooks/useNetworkStatus';

/**
 * Hook for fetching feed posts with offline support
 * 
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of posts to fetch
 * @returns {Object} { data, loading, error, refetch }
 */
export const useFeedPosts = (userId, limit = 10) => {
  return useOfflineData({
    fetchOnlineData: async () => {
      const { PostService } = await import('../services/FirebaseService');
      const blockedUsers = await LocalStorageService.getBlockedUsers();
      return PostService.getFeedPosts(userId, blockedUsers, limit);
    },
    getCachedData: LocalStorageService.getFeedPosts,
    cacheData: LocalStorageService.saveFeedPosts,
    dependencies: [userId, limit],
  });
};

/**
 * Hook for fetching user posts with offline support
 * 
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of posts to fetch
 * @returns {Object} { data, loading, error, refetch }
 */
export const useUserPosts = (userId, limit = 10) => {
  return useOfflineData({
    fetchOnlineData: async () => {
      const { PostService } = await import('../services/FirebaseService');
      return PostService.getUserPosts(userId, limit);
    },
    getCachedData: async () => LocalStorageService.getUserPosts(userId),
    cacheData: async (posts) => LocalStorageService.saveUserPosts(userId, posts),
    dependencies: [userId, limit],
  });
};

/**
 * Hook for fetching user profile with offline support
 * 
 * @param {string} userId - User ID
 * @returns {Object} { data, loading, error, refetch }
 */
export const useUserProfile = (userId) => {
  return useOfflineData({
    fetchOnlineData: async () => {
      const { UserService } = await import('../services/FirebaseService');
      return UserService.getUserProfile(userId);
    },
    getCachedData: async () => LocalStorageService.getUserProfile(userId),
    cacheData: async (profile) => LocalStorageService.saveUserProfile(userId, profile),
    dependencies: [userId],
  });
};

/**
 * Hook for fetching post comments with offline support
 * 
 * @param {string} postId - Post ID
 * @param {number} limit - Maximum number of comments to fetch
 * @returns {Object} { data, loading, error, refetch }
 */
export const usePostComments = (postId, limit = 20) => {
  return useOfflineData({
    fetchOnlineData: async () => {
      const { CommentService } = await import('../services/FirebaseService');
      const blockedUsers = await LocalStorageService.getBlockedUsers();
      return CommentService.getComments(postId, blockedUsers, limit);
    },
    getCachedData: async () => LocalStorageService.getComments(postId),
    cacheData: async (comments) => LocalStorageService.saveComments(postId, comments),
    dependencies: [postId, limit],
  });
};
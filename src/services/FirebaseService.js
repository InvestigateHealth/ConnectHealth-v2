// src/services/FirebaseService.js
// Centralized service for all Firebase operations

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsService } from './AnalyticsService';
import NetInfo from '@react-native-community/netinfo';

// Cache constants
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const POST_CACHE_KEY = '@cache_posts';
const USER_CACHE_KEY = '@cache_user_';

/**
 * Authentication service for Firebase auth operations
 */
export const AuthService = {
  /**
   * Sign in with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<UserCredential>} User credential
   */
  signIn: async (email, password) => {
    try {
      const result = await auth().signInWithEmailAndPassword(email, password);
      AnalyticsService.logEvent('login', { method: 'email' });
      AnalyticsService.identifyUser(result.user.uid);
      return result;
    } catch (error) {
      AnalyticsService.logError(error.message, 'login_error', { code: error.code });
      throw error;
    }
  },

  /**
   * Sign up with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<UserCredential>} User credential
   */
  signUp: async (email, password) => {
    try {
      const result = await auth().createUserWithEmailAndPassword(email, password);
      AnalyticsService.logEvent('signup', { method: 'email' });
      return result;
    } catch (error) {
      AnalyticsService.logError(error.message, 'signup_error', { code: error.code });
      throw error;
    }
  },

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  signOut: async () => {
    try {
      await auth().signOut();
      AnalyticsService.resetUser();
      AnalyticsService.logEvent('logout');
    } catch (error) {
      AnalyticsService.logError(error.message, 'signout_error', { code: error.code });
      throw error;
    }
  },

  /**
   * Reset password for email
   * @param {string} email - User email
   * @returns {Promise<void>}
   */
  resetPassword: async (email) => {
    try {
      await auth().sendPasswordResetEmail(email);
      AnalyticsService.logEvent('reset_password_request', { email_provided: !!email });
    } catch (error) {
      AnalyticsService.logError(error.message, 'reset_password_error', { code: error.code });
      throw error;
    }
  },

  /**
   * Update user profile
   * @param {FirebaseUser} user - Firebase user object
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<void>}
   */
  updateProfile: async (user, profileData) => {
    try {
      const timestamp = firestore.FieldValue.serverTimestamp();
      
      // Update user document in Firestore
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          ...profileData,
          id: user.uid,
          email: user.email,
          createdAt: timestamp,
          updatedAt: timestamp,
          joinDate: timestamp,
        }, { merge: true });
      
      // Update cached user data
      await AsyncStorage.setItem(
        `${USER_CACHE_KEY}${user.uid}`,
        JSON.stringify({
          ...profileData,
          id: user.uid,
          email: user.email,
          updatedAt: Date.now(),
        })
      );
      
      AnalyticsService.logEvent('update_profile');
    } catch (error) {
      AnalyticsService.logError(error.message, 'update_profile_error');
      throw error;
    }
  },

  /**
   * Delete user account
   * @returns {Promise<void>}
   */
  deleteAccount: async () => {
    const user = auth().currentUser;
    if (!user) throw new Error('No user is currently signed in');
    
    try {
      // Delete all user data from Firestore
      await firestore().collection('users').doc(user.uid).delete();
      
      // Delete user authentication
      await user.delete();
      
      AnalyticsService.logEvent('delete_account');
      AnalyticsService.resetUser();
    } catch (error) {
      AnalyticsService.logError(error.message, 'delete_account_error');
      throw error;
    }
  },
};

/**
 * User service for Firestore user operations
 */
export const UserService = {
  /**
   * Get user data by ID
   * @param {string} userId - User ID
   * @param {boolean} useCache - Whether to use cached data
   * @returns {Promise<Object>} User data
   */
  getUserById: async (userId, useCache = true) => {
    if (!userId) throw new Error('User ID is required');
    
    try {
      // Check if we're offline
      const networkState = await NetInfo.fetch();
      const isOffline = !networkState.isConnected || !networkState.isInternetReachable;
      
      // Try to get from cache first if useCache is true or we're offline
      if (useCache || isOffline) {
        const cachedData = await AsyncStorage.getItem(`${USER_CACHE_KEY}${userId}`);
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          
          // Return cached data if we're offline or cache is fresh
          if (isOffline || Date.now() - parsedData.updatedAt < CACHE_EXPIRY) {
            return parsedData;
          }
        }
      }
      
      // If not in cache or cache expired, fetch from Firestore
      if (!isOffline) {
        const userDoc = await firestore().collection('users').doc(userId).get();
        
        if (userDoc.exists) {
          const userData = {
            id: userDoc.id,
            ...userDoc.data(),
            updatedAt: Date.now(),
          };
          
          // Cache the result
          await AsyncStorage.setItem(`${USER_CACHE_KEY}${userId}`, JSON.stringify(userData));
          
          return userData;
        }
      }
      
      throw new Error('User not found');
    } catch (error) {
      if (error.message !== 'User not found') {
        AnalyticsService.logError(error.message, 'get_user_error', { userId });
      }
      throw error;
    }
  },

  /**
   * Update user data
   * @param {string} userId - User ID
   * @param {Object} data - User data to update
   * @returns {Promise<void>}
   */
  updateUser: async (userId, data) => {
    if (!userId) throw new Error('User ID is required');
    
    try {
      // Update in Firestore
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          ...data,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      
      // Update local cache
      const cachedData = await AsyncStorage.getItem(`${USER_CACHE_KEY}${userId}`);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        await AsyncStorage.setItem(
          `${USER_CACHE_KEY}${userId}`,
          JSON.stringify({
            ...parsedData,
            ...data,
            updatedAt: Date.now(),
          })
        );
      }
      
      AnalyticsService.logEvent('update_user_data');
    } catch (error) {
      AnalyticsService.logError(error.message, 'update_user_error');
      throw error;
    }
  },

  /**
   * Follow a user
   * @param {string} userId - Current user ID
   * @param {string} targetUserId - User ID to follow
   * @returns {Promise<string>} Connection ID
   */
  followUser: async (userId, targetUserId) => {
    if (!userId || !targetUserId) throw new Error('Both user IDs are required');
    if (userId === targetUserId) throw new Error('Cannot follow yourself');
    
    try {
      // Check if already following
      const existingConnection = await firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .where('connectedUserId', '==', targetUserId)
        .get();
      
      if (!existingConnection.empty) {
        return existingConnection.docs[0].id;
      }
      
      // Create connection
      const connectionRef = await firestore().collection('connections').add({
        userId: userId,
        connectedUserId: targetUserId,
        timestamp: firestore.FieldValue.serverTimestamp(),
      });
      
      // Create notification
      await firestore().collection('notifications').add({
        type: 'follow',
        senderId: userId,
        recipientId: targetUserId,
        timestamp: firestore.FieldValue.serverTimestamp(),
        read: false,
      });
      
      AnalyticsService.logEvent('follow_user', { targetUserId });
      
      return connectionRef.id;
    } catch (error) {
      AnalyticsService.logError(error.message, 'follow_user_error');
      throw error;
    }
  },

  /**
   * Unfollow a user
   * @param {string} userId - Current user ID
   * @param {string} targetUserId - User ID to unfollow
   * @returns {Promise<boolean>} Success status
   */
  unfollowUser: async (userId, targetUserId) => {
    if (!userId || !targetUserId) throw new Error('Both user IDs are required');
    
    try {
      // Find and delete the connection
      const snapshot = await firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .where('connectedUserId', '==', targetUserId)
        .get();
      
      if (snapshot.empty) return false;
      
      // Delete all matching connections (should only be one)
      const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      
      // Delete follow notification
      const notificationSnapshot = await firestore()
        .collection('notifications')
        .where('type', '==', 'follow')
        .where('senderId', '==', userId)
        .where('recipientId', '==', targetUserId)
        .get();
      
      const notificationDeletes = notificationSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(notificationDeletes);
      
      AnalyticsService.logEvent('unfollow_user', { targetUserId });
      
      return true;
    } catch (error) {
      AnalyticsService.logError(error.message, 'unfollow_user_error');
      throw error;
    }
  },

  /**
   * Block a user
   * @param {string} userId - Current user ID
   * @param {string} targetUserId - User ID to block
   * @param {string} reason - Reason for blocking
   * @returns {Promise<boolean>} Success status
   */
  blockUser: async (userId, targetUserId, reason = '') => {
    if (!userId || !targetUserId) throw new Error('Both user IDs are required');
    if (userId === targetUserId) throw new Error('Cannot block yourself');
    
    try {
      // Add to blocks collection
      await firestore().collection('blocks').add({
        blockedBy: userId,
        blockedUser: targetUserId,
        reason,
        timestamp: firestore.FieldValue.serverTimestamp(),
      });
      
      // Unfollow the user if following
      await UserService.unfollowUser(userId, targetUserId);
      
      // Remove if the blocked user is following the current user
      const reverseSnapshot = await firestore()
        .collection('connections')
        .where('userId', '==', targetUserId)
        .where('connectedUserId', '==', userId)
        .get();
      
      const reverseDeletes = reverseSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(reverseDeletes);
      
      AnalyticsService.logEvent('block_user', { targetUserId, reason });
      
      return true;
    } catch (error) {
      AnalyticsService.logError(error.message, 'block_user_error');
      throw error;
    }
  },

  /**
   * Unblock a user
   * @param {string} userId - Current user ID
   * @param {string} targetUserId - User ID to unblock
   * @returns {Promise<boolean>} Success status
   */
  unblockUser: async (userId, targetUserId) => {
    if (!userId || !targetUserId) throw new Error('Both user IDs are required');
    
    try {
      // Find and delete the block
      const snapshot = await firestore()
        .collection('blocks')
        .where('blockedBy', '==', userId)
        .where('blockedUser', '==', targetUserId)
        .get();
      
      if (snapshot.empty) return false;
      
      // Delete all matching blocks (should only be one)
      const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      
      AnalyticsService.logEvent('unblock_user', { targetUserId });
      
      return true;
    } catch (error) {
      AnalyticsService.logError(error.message, 'unblock_user_error');
      throw error;
    }
  },

  /**
   * Get blocked users
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of blocked user IDs
   */
  getBlockedUsers: async (userId) => {
    if (!userId) throw new Error('User ID is required');
    
    try {
      const snapshot = await firestore()
        .collection('blocks')
        .where('blockedBy', '==', userId)
        .get();
      
      return snapshot.docs.map(doc => doc.data().blockedUser);
    } catch (error) {
      AnalyticsService.logError(error.message, 'get_blocked_users_error');
      throw error;
    }
  },

  /**
   * Check if a user is blocked
   * @param {string} userId - Current user ID
   * @param {string} targetUserId - User ID to check
   * @returns {Promise<boolean>} Whether the user is blocked
   */
  isUserBlocked: async (userId, targetUserId) => {
    if (!userId || !targetUserId) throw new Error('Both user IDs are required');
    
    try {
      const snapshot = await firestore()
        .collection('blocks')
        .where('blockedBy', '==', userId)
        .where('blockedUser', '==', targetUserId)
        .limit(1)
        .get();
      
      return !snapshot.empty;
    } catch (error) {
      AnalyticsService.logError(error.message, 'is_user_blocked_error');
      throw error;
    }
  },
};

/**
 * Post service for Firestore post operations
 */
export const PostService = {
  /**
   * Create a new post
   * @param {Object} postData - Post data
   * @returns {Promise<string>} Post ID
   */
  createPost: async (postData) => {
    const user = auth().currentUser;
    if (!user) throw new Error('No user is currently signed in');
    
    try {
      // Add post to Firestore
      const postRef = await firestore().collection('posts').add({
        ...postData,
        userId: user.uid,
        timestamp: firestore.FieldValue.serverTimestamp(),
        likeCount: 0,
        commentCount: 0,
      });
      
      AnalyticsService.logEvent('create_post', { postType: postData.type });
      
      return postRef.id;
    } catch (error) {
      AnalyticsService.logError(error.message, 'create_post_error');
      throw error;
    }
  },

  /**
   * Get post by ID
   * @param {string} postId - Post ID
   * @returns {Promise<Object>} Post data
   */
  getPostById: async (postId) => {
    try {
      const postDoc = await firestore().collection('posts').doc(postId).get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      return {
        id: postDoc.id,
        ...postDoc.data(),
        timestamp: postDoc.data().timestamp?.toDate() || new Date(),
      };
    } catch (error) {
      AnalyticsService.logError(error.message, 'get_post_error', { postId });
      throw error;
    }
  },

  /**
   * Get posts for feed
   * @param {Array} userIds - Array of user IDs to get posts from
   * @param {number} limit - Maximum number of posts to get
   * @param {Object} lastVisible - Last document for pagination
   * @param {boolean} useCache - Whether to use cached data
   * @returns {Promise<Object>} Posts data and last visible document
   */
  getFeedPosts: async (userIds, limit = 10, lastVisible = null, useCache = true) => {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('User IDs array is required');
    }
    
    try {
      // Check if we're offline
      const networkState = await NetInfo.fetch();
      const isOffline = !networkState.isConnected || !networkState.isInternetReachable;
      
      // Try to get from cache first if useCache is true or we're offline
      if ((useCache || isOffline) && !lastVisible) {
        const cachedData = await AsyncStorage.getItem(POST_CACHE_KEY);
        if (cachedData) {
          const { posts, timestamp } = JSON.parse(cachedData);
          
          // Return cached data if we're offline or cache is fresh
          if (isOffline || Date.now() - timestamp < CACHE_EXPIRY) {
            // Filter cached posts for the specified userIds
            const filteredPosts = posts.filter(post => userIds.includes(post.userId));
            return { posts: filteredPosts, lastVisible: null };
          }
        }
      }
      
      // If offline and no cache, return empty
      if (isOffline) {
        return { posts: [], lastVisible: null };
      }
      
      // Using chunks to avoid the "in" query limitation (max 10 items)
      const maxChunkSize = 10;
      let allPosts = [];
      let lastDoc = null;
      
      // Split userIds into chunks
      for (let i = 0; i < userIds.length; i += maxChunkSize) {
        const chunk = userIds.slice(i, i + maxChunkSize);
        
        let query = firestore()
          .collection('posts')
          .where('userId', 'in', chunk)
          .orderBy('timestamp', 'desc');
        
        // Apply pagination if provided
        if (lastVisible && i === 0) {
          query = query.startAfter(lastVisible);
        }
        
        query = query.limit(limit);
        
        const snapshot = await query.get();
        
        if (!snapshot.empty) {
          const chunkPosts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date(),
          }));
          
          allPosts = [...allPosts, ...chunkPosts];
          
          // Keep track of the last document for each chunk
          if (i === 0) {
            lastDoc = snapshot.docs[snapshot.docs.length - 1];
          }
        }
      }
      
      // Sort all posts by timestamp
      allPosts.sort((a, b) => b.timestamp - a.timestamp);
      
      // Limit to the requested number
      allPosts = allPosts.slice(0, limit);
      
      // Cache posts if this is the first page
      if (!lastVisible) {
        await AsyncStorage.setItem(
          POST_CACHE_KEY,
          JSON.stringify({
            posts: allPosts,
            timestamp: Date.now(),
          })
        );
      }
      
      return { posts: allPosts, lastVisible: lastDoc };
    } catch (error) {
      console.error('Error getting feed posts:', error);
      AnalyticsService.logError(error.message, 'get_feed_posts_error');
      throw error;
    }
  },

  /**
   * Like a post
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  likePost: async (postId, userId) => {
    if (!postId || !userId) throw new Error('Post ID and User ID are required');
    
    try {
      // Check if already liked
      const likeDoc = await firestore()
        .collection('likes')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!likeDoc.empty) {
        return false; // Already liked
      }
      
      // Create a new like document
      await firestore().collection('likes').add({
        postId,
        userId,
        timestamp: firestore.FieldValue.serverTimestamp(),
      });
      
      // Increment like count on post
      await firestore()
        .collection('posts')
        .doc(postId)
        .update({
          likeCount: firestore.FieldValue.increment(1),
        });
      
      // Get post details for notification
      const postDoc = await firestore().collection('posts').doc(postId).get();
      if (postDoc.exists && postDoc.data().userId !== userId) {
        // Create notification
        await firestore().collection('notifications').add({
          type: 'like',
          postId,
          senderId: userId,
          recipientId: postDoc.data().userId,
          timestamp: firestore.FieldValue.serverTimestamp(),
          read: false,
        });
      }
      
      AnalyticsService.logEvent('like_post', { postId });
      
      return true;
    } catch (error) {
      AnalyticsService.logError(error.message, 'like_post_error');
      throw error;
    }
  },

  /**
   * Unlike a post
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  unlikePost: async (postId, userId) => {
    if (!postId || !userId) throw new Error('Post ID and User ID are required');
    
    try {
      // Find like document
      const likeQuery = await firestore()
        .collection('likes')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (likeQuery.empty) {
        return false; // Not liked
      }
      
      // Delete the like document
      await likeQuery.docs[0].ref.delete();
      
      // Decrement like count on post
      await firestore()
        .collection('posts')
        .doc(postId)
        .update({
          likeCount: firestore.FieldValue.increment(-1),
        });
      
      // Remove notification
      const notificationQuery = await firestore()
        .collection('notifications')
        .where('type', '==', 'like')
        .where('postId', '==', postId)
        .where('senderId', '==', userId)
        .limit(1)
        .get();
      
      if (!notificationQuery.empty) {
        await notificationQuery.docs[0].ref.delete();
      }
      
      AnalyticsService.logEvent('unlike_post', { postId });
      
      return true;
    } catch (error) {
      AnalyticsService.logError(error.message, 'unlike_post_error');
      throw error;
    }
  },

  /**
   * Delete a post
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  deletePost: async (postId, userId) => {
    if (!postId || !userId) throw new Error('Post ID and User ID are required');
    
    try {
      // Verify ownership
      const postDoc = await firestore().collection('posts').doc(postId).get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      if (postDoc.data().userId !== userId) {
        throw new Error('Not authorized to delete this post');
      }
      
      // Delete the post
      await postDoc.ref.delete();
      
      // Delete related likes
      const likesQuery = await firestore()
        .collection('likes')
        .where('postId', '==', postId)
        .get();
      
      const likeDeletions = likesQuery.docs.map(doc => doc.ref.delete());
      await Promise.all(likeDeletions);
      
      // Delete related comments
      const commentsQuery = await firestore()
        .collection('comments')
        .where('postId', '==', postId)
        .get();
      
      const commentDeletions = commentsQuery.docs.map(doc => doc.ref.delete());
      await Promise.all(commentDeletions);
      
      // Delete related notifications
      const notificationsQuery = await firestore()
        .collection('notifications')
        .where('postId', '==', postId)
        .get();
      
      const notificationDeletions = notificationsQuery.docs.map(doc => doc.ref.delete());
      await Promise.all(notificationDeletions);
      
      // If post has content URL, delete from storage
      if (postDoc.data().content && postDoc.data().content.startsWith('https://firebasestorage.googleapis.com')) {
        try {
          const storageRef = storage().refFromURL(postDoc.data().content);
          await storageRef.delete();
        } catch (storageError) {
          console.error('Error deleting post media:', storageError);
          // Continue despite storage delete error
        }
      }
      
      AnalyticsService.logEvent('delete_post', { postId });
      
      return true;
    } catch (error) {
      AnalyticsService.logError(error.message, 'delete_post_error');
      throw error;
    }
  },

  /**
   * Report a post
   * @param {string} postId - Post ID
   * @param {string} userId - User ID reporting
   * @param {string} reason - Reason for report
   * @param {string} additionalInfo - Additional information
   * @returns {Promise<string>} Report ID
   */
  reportPost: async (postId, userId, reason, additionalInfo = '') => {
    if (!postId || !userId || !reason) {
      throw new Error('Post ID, User ID, and reason are required');
    }
    
    try {
      // Get post data for report context
      const postDoc = await firestore().collection('posts').doc(postId).get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      // Create report
      const reportRef = await firestore().collection('reports').add({
        type: 'post',
        contentId: postId,
        reportedBy: userId,
        reportedUserId: postDoc.data().userId,
        reason,
        additionalInfo,
        timestamp: firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        reviewed: false,
      });
      
      AnalyticsService.logEvent('report_post', { postId, reason });
      
      return reportRef.id;
    } catch (error) {
      AnalyticsService.logError(error.message, 'report_post_error');
      throw error;
    }
  },
};

/**
 * Comment service for Firestore comment operations
 */
export const CommentService = {
  /**
   * Add a comment to a post
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @param {string} text - Comment text
   * @returns {Promise<string>} Comment ID
   */
  addComment: async (postId, userId, text) => {
    if (!postId || !userId || !text.trim()) {
      throw new Error('Post ID, User ID, and text are required');
    }
    
    try {
      // Get user data for comment
      const userDoc = await firestore().collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }
      
      // Create comment
      const commentRef = await firestore().collection('comments').add({
        postId,
        userId,
        userFullName: `${userDoc.data().firstName || ''} ${userDoc.data().lastName || ''}`.trim(),
        userProfileImageURL: userDoc.data().profileImageURL || null,
        text: text.trim(),
        timestamp: firestore.FieldValue.serverTimestamp(),
        edited: false,
      });
      
      // Increment comment count on post
      await firestore()
        .collection('posts')
        .doc(postId)
        .update({
          commentCount: firestore.FieldValue.increment(1),
        });
      
      // Get post details for notification
      const postDoc = await firestore().collection('posts').doc(postId).get();
      if (postDoc.exists && postDoc.data().userId !== userId) {
        // Create notification
        await firestore().collection('notifications').add({
          type: 'comment',
          postId,
          commentId: commentRef.id,
          senderId: userId,
          recipientId: postDoc.data().userId,
          message: 'commented on your post',
          timestamp: firestore.FieldValue.serverTimestamp(),
          read: false,
        });
      }
      
      AnalyticsService.logEvent('add_comment', { postId });
      
      return commentRef.id;
    } catch (error) {
      AnalyticsService.logError(error.message, 'add_comment_error');
      throw error;
    }
  },

  /**
   * Edit a comment
   * @param {string} commentId - Comment ID
   * @param {string} userId - User ID
   * @param {string} text - Updated comment text
   * @returns {Promise<boolean>} Success status
   */
  editComment: async (commentId, userId, text) => {
    if (!commentId || !userId || !text.trim()) {
      throw new Error('Comment ID, User ID, and text are required');
    }
    
    try {
      // Verify ownership
      const commentDoc = await firestore().collection('comments').doc(commentId).get();
      
      if (!commentDoc.exists) {
        throw new Error('Comment not found');
      }
      
      if (commentDoc.data().userId !== userId) {
        throw new Error('Not authorized to edit this comment');
      }
      
      // Update comment
      await commentDoc.ref.update({
        text: text.trim(),
        edited: true,
        editTimestamp: firestore.FieldValue.serverTimestamp(),
      });
      
      AnalyticsService.logEvent('edit_comment', { commentId });
      
      return true;
    } catch (error) {
      AnalyticsService.logError(error.message, 'edit_comment_error');
      throw error;
    }
  },

  /**
   * Delete a comment
   * @param {string} commentId - Comment ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  deleteComment: async (commentId, userId) => {
    if (!commentId || !userId) throw new Error('Comment ID and User ID are required');
    
    try {
      // Verify ownership
      const commentDoc = await firestore().collection('comments').doc(commentId).get();
      
      if (!commentDoc.exists) {
        throw new Error('Comment not found');
      }
      
      // Check if owner or post owner
      const isCommenter = commentDoc.data().userId === userId;
      const postId = commentDoc.data().postId;
      
      let isPostOwner = false;
      if (!isCommenter && postId) {
        const postDoc = await firestore().collection('posts').doc(postId).get();
        isPostOwner = postDoc.exists && postDoc.data().userId === userId;
      }
      
      if (!isCommenter && !isPostOwner) {
        throw new Error('Not authorized to delete this comment');
      }
      
      // Delete the comment
      await commentDoc.ref.delete();
      
      // Decrement comment count on post
      if (postId) {
        await firestore()
          .collection('posts')
          .doc(postId)
          .update({
            commentCount: firestore.FieldValue.increment(-1),
          });
      }
      
      // Delete related notifications
      const notificationsQuery = await firestore()
        .collection('notifications')
        .where('commentId', '==', commentId)
        .get();
      
      const notificationDeletions = notificationsQuery.docs.map(doc => doc.ref.delete());
      await Promise.all(notificationDeletions);
      
      AnalyticsService.logEvent('delete_comment', { commentId });
      
      return true;
    } catch (error) {
      AnalyticsService.logError(error.message, 'delete_comment_error');
      throw error;
    }
  },

  /**
   * Report a comment
   * @param {string} commentId - Comment ID
   * @param {string} userId - User ID reporting
   * @param {string} reason - Reason for report
   * @param {string} additionalInfo - Additional information
   * @returns {Promise<string>} Report ID
   */
  reportComment: async (commentId, userId, reason, additionalInfo = '') => {
    if (!commentId || !userId || !reason) {
      throw new Error('Comment ID, User ID, and reason are required');
    }
    
    try {
      // Get comment data for report context
      const commentDoc = await firestore().collection('comments').doc(commentId).get();
      
      if (!commentDoc.exists) {
        throw new Error('Comment not found');
      }
      
      // Create report
      const reportRef = await firestore().collection('reports').add({
        type: 'comment',
        contentId: commentId,
        postId: commentDoc.data().postId,
        reportedBy: userId,
        reportedUserId: commentDoc.data().userId,
        reason,
        additionalInfo,
        timestamp: firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        reviewed: false,
      });
      
      AnalyticsService.logEvent('report_comment', { commentId, reason });
      
      return reportRef.id;
    } catch (error) {
      AnalyticsService.logError(error.message, 'report_comment_error');
      throw error;
    }
  },
};

/**
 * Notification service for Firestore notification operations
 */
export const NotificationService = {
  /**
   * Get notifications for a user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of notifications to get
   * @param {Object} lastVisible - Last document for pagination
   * @returns {Promise<Object>} Notifications data and last visible document
   */
  getNotifications: async (userId, limit = 20, lastVisible = null) => {
    if (!userId) throw new Error('User ID is required');
    
    try {
      let query = firestore()
        .collection('notifications')
        .where('recipientId', '==', userId)
        .orderBy('timestamp', 'desc');
      
      // Apply pagination if provided
      if (lastVisible) {
        query = query.startAfter(lastVisible);
      }
      
      query = query.limit(limit);
      
      const snapshot = await query.get();
      
      const notifications = [];
      
      // Process notifications
      for (const doc of snapshot.docs) {
        const notification = {
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
        };
        
        // Get sender info if available
        if (notification.senderId) {
          try {
            const senderDoc = await firestore().collection('users').doc(notification.senderId).get();
            if (senderDoc.exists) {
              notification.senderName = `${senderDoc.data().firstName || ''} ${senderDoc.data().lastName || ''}`.trim();
              notification.senderProfileImage = senderDoc.data().profileImageURL;
            }
          } catch (senderError) {
            console.error('Error getting notification sender:', senderError);
          }
        }
        
        notifications.push(notification);
      }
      
      const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
      
      return { notifications, lastVisible: lastDoc };
    } catch (error) {
      AnalyticsService.logError(error.message, 'get_notifications_error');
      throw error;
    }
  },

  /**
   * Mark a notification as read
   * @param {string} notificationId - Notification ID
   * @returns {Promise<boolean>} Success status
   */
  markAsRead: async (notificationId) => {
    if (!notificationId) throw new Error('Notification ID is required');
    
    try {
      await firestore()
        .collection('notifications')
        .doc(notificationId)
        .update({
          read: true,
          readTimestamp: firestore.FieldValue.serverTimestamp(),
        });
      
      return true;
    } catch (error) {
      AnalyticsService.logError(error.message, 'mark_notification_read_error');
      throw error;
    }
  },

  /**
   * Mark all notifications as read
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of notifications marked as read
   */
  markAllAsRead: async (userId) => {
    if (!userId) throw new Error('User ID is required');
    
    try {
      const batch = firestore().batch();
      let count = 0;
      
      // Get unread notifications
      const snapshot = await firestore()
        .collection('notifications')
        .where('recipientId', '==', userId)
        .where('read', '==', false)
        .get();
      
      if (snapshot.empty) return 0;
      
      // Update all in batch
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          read: true,
          readTimestamp: firestore.FieldValue.serverTimestamp(),
        });
        count++;
      });
      
      await batch.commit();
      
      AnalyticsService.logEvent('mark_all_notifications_read', { count });
      
      return count;
    } catch (error) {
      AnalyticsService.logError(error.message, 'mark_all_notifications_read_error');
      throw error;
    }
  },

  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  deleteNotification: async (notificationId, userId) => {
    if (!notificationId || !userId) {
      throw new Error('Notification ID and User ID are required');
    }
    
    try {
      // Verify ownership
      const notificationDoc = await firestore().collection('notifications').doc(notificationId).get();
      
      if (!notificationDoc.exists) {
        throw new Error('Notification not found');
      }
      
      if (notificationDoc.data().recipientId !== userId) {
        throw new Error('Not authorized to delete this notification');
      }
      
      // Delete the notification
      await notificationDoc.ref.delete();
      
      return true;
    } catch (error) {
      AnalyticsService.logError(error.message, 'delete_notification_error');
      throw error;
    }
  },
};

/**
 * Upload service for Firebase Storage operations
 */
export const UploadService = {
  /**
   * Upload an image to Firebase Storage
   * @param {string} uri - Local URI of the image
   * @param {string} storagePath - Path in Firebase Storage
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} Download URL
   */
  uploadImage: async (uri, storagePath, onProgress = null) => {
    if (!uri || !storagePath) throw new Error('URI and storage path are required');
    
    try {
      // Create storage reference
      const reference = storage().ref(storagePath);
      
      // Start upload task
      const task = reference.putFile(uri);
      
      // Listen for progress
      if (onProgress) {
        task.on('state_changed', snapshot => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        });
      }
      
      // Wait for upload to complete
      await task;
      
      // Get download URL
      const url = await reference.getDownloadURL();
      
      return url;
    } catch (error) {
      AnalyticsService.logError(error.message, 'upload_image_error');
      throw error;
    }
  },

  /**
   * Upload a video to Firebase Storage
   * @param {string} uri - Local URI of the video
   * @param {string} storagePath - Path in Firebase Storage
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} Download URL
   */
  uploadVideo: async (uri, storagePath, onProgress = null) => {
    if (!uri || !storagePath) throw new Error('URI and storage path are required');
    
    try {
      // Create storage reference
      const reference = storage().ref(storagePath);
      
      // Start upload task
      const task = reference.putFile(uri);
      
      // Listen for progress
      if (onProgress) {
        task.on('state_changed', snapshot => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        });
      }
      
      // Wait for upload to complete
      await task;
      
      // Get download URL
      const url = await reference.getDownloadURL();
      
      return url;
    } catch (error) {
      AnalyticsService.logError(error.message, 'upload_video_error');
      throw error;
    }
  },

  /**
   * Delete a file from Firebase Storage
   * @param {string} url - Firebase Storage URL
   * @returns {Promise<boolean>} Success status
   */
  deleteFile: async (url) => {
    if (!url || !url.startsWith('https://firebasestorage.googleapis.com')) {
      throw new Error('Valid Firebase Storage URL is required');
    }
    
    try {
      const reference = storage().refFromURL(url);
      await reference.delete();
      
      return true;
    } catch (error) {
      AnalyticsService.logError(error.message, 'delete_file_error');
      throw error;
    }
  },
};

/**
 * Block service for handling user blocks
 */
export const BlockService = {
  /**
   * Get details of users blocked by the current user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of blocked user objects with details
   */
  getBlockedUserDetails: async (userId) => {
    if (!userId) throw new Error('User ID is required');
    
    try {
      // Get blocks
      const blocksSnapshot = await firestore()
        .collection('blocks')
        .where('blockedBy', '==', userId)
        .get();
      
      if (blocksSnapshot.empty) return [];
      
      // Get details for each blocked user
      const blockedUserDetails = [];
      
      for (const doc of blocksSnapshot.docs) {
        const blockData = doc.data();
        const blockedUserId = blockData.blockedUser;
        
        try {
          const userDoc = await firestore().collection('users').doc(blockedUserId).get();
          
          if (userDoc.exists) {
            blockedUserDetails.push({
              id: blockedUserId,
              ...userDoc.data(),
              blockInfo: {
                id: doc.id,
                reason: blockData.reason || '',
                timestamp: blockData.timestamp?.toDate() || new Date(),
              },
            });
          }
        } catch (userError) {
          console.error('Error getting blocked user details:', userError);
        }
      }
      
      return blockedUserDetails;
    } catch (error) {
      AnalyticsService.logError(error.message, 'get_blocked_user_details_error');
      throw error;
    }
  },
};

export default {
  AuthService,
  UserService,
  PostService,
  CommentService,
  NotificationService,
  UploadService,
  BlockService,
};

// src/utils/FirebaseUtils.js
// Utility functions for Firebase operations

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SecurityUtils from './SecurityUtils';

/**
 * Firebase utilities for authentication, data operations,
 * storage, and messaging
 */
class FirebaseUtils {
  /**
   * Initialize Firebase utilities
   */
  constructor() {
    this.auth = auth;
    this.firestore = firestore;
    this.storage = storage;
    this.messaging = messaging;
    this.currentUser = null;

    // Initialize current user
    this.auth().onAuthStateChanged(user => {
      this.currentUser = user;
    });
  }

  /**
   * Get the current authenticated user
   * 
   * @returns {Object|null} Current Firebase user or null
   */
  getCurrentUser() {
    return this.auth().currentUser;
  }

  /**
   * Get user data from Firestore
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User data
   */
  async getUserData(userId) {
    try {
      const docRef = await this.firestore().collection('users').doc(userId).get();
      
      if (!docRef.exists) {
        throw new Error('User not found');
      }
      
      return {
        id: docRef.id,
        ...docRef.data(),
        joinDate: docRef.data().joinDate?.toDate() || null
      };
    } catch (error) {
      console.error('Error getting user data:', error);
      throw error;
    }
  }

  /**
   * Create or update user document in Firestore
   * 
   * @param {string} userId - User ID
   * @param {Object} userData - User data to save
   * @param {boolean} merge - Whether to merge with existing data
   * @returns {Promise<void>}
   */
  async setUserData(userId, userData, merge = true) {
    try {
      // Sanitize data before saving
      const sanitizedData = {};
      
      for (const [key, value] of Object.entries(userData)) {
        // Sanitize strings to prevent XSS
        if (typeof value === 'string') {
          sanitizedData[key] = SecurityUtils.sanitizeInput(value);
        } else {
          sanitizedData[key] = value;
        }
      }
      
      // Add timestamp if creating new document
      if (!merge) {
        sanitizedData.joinDate = firestore.FieldValue.serverTimestamp();
      }
      
      return await this.firestore()
        .collection('users')
        .doc(userId)
        .set(sanitizedData, { merge });
    } catch (error) {
      console.error('Error setting user data:', error);
      throw error;
    }
  }

  /**
   * Update user profile data in Firestore
   * 
   * @param {string} userId - User ID
   * @param {Object} updates - Data to update
   * @returns {Promise<void>}
   */
  async updateUserProfile(userId, updates) {
    try {
      const sanitizedUpdates = {};
      
      // Sanitize input data
      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === 'string') {
          sanitizedUpdates[key] = SecurityUtils.sanitizeInput(value);
        } else {
          sanitizedUpdates[key] = value;
        }
      }
      
      // Add last updated timestamp
      sanitizedUpdates.lastUpdated = firestore.FieldValue.serverTimestamp();
      
      return await this.firestore()
        .collection('users')
        .doc(userId)
        .update(sanitizedUpdates);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Sign in user with email and password
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User credential
   */
  async signIn(email, password) {
    try {
      return await this.auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
      console.error('Sign in error:', error);
      
      // Translate Firebase errors to user-friendly messages
      switch (error.code) {
        case 'auth/invalid-email':
          throw new Error('Invalid email address');
        case 'auth/user-disabled':
          throw new Error('This account has been disabled');
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          throw new Error('Invalid email or password');
        default:
          throw new Error('Failed to sign in. Please try again.');
      }
    }
  }

  /**
   * Create a new user account
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {Object} profileData - Additional profile data
   * @returns {Promise<Object>} User credential
   */
  async signUp(email, password, profileData = {}) {
    try {
      // Check for disposable email 
      if (SecurityUtils.isDisposableEmail(email)) {
        throw new Error('Please use a non-disposable email address');
      }

      // Create user account
      const userCredential = await this.auth().createUserWithEmailAndPassword(email, password);
      
      // Create user document in Firestore
      await this.setUserData(userCredential.user.uid, {
        email,
        ...profileData,
        isNewUser: true,
        emailVerified: false,
        medicalConditions: profileData.medicalConditions || [],
        role: 'user',
        status: 'active',
      }, false);
      
      // Create audit log
      await SecurityUtils.createAuditLog(
        userCredential.user.uid,
        'account_created',
        { email, platform: Platform.OS }
      );
      
      return userCredential;
    } catch (error) {
      console.error('Sign up error:', error);
      
      // Translate Firebase errors
      switch (error.code) {
        case 'auth/email-already-in-use':
          throw new Error('Email is already in use');
        case 'auth/invalid-email':
          throw new Error('Invalid email address');
        case 'auth/weak-password':
          throw new Error('Password is too weak');
        default:
          throw error;
      }
    }
  }

  /**
   * Sign out the current user
   * 
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      // Get user ID before signing out for audit log
      const userId = this.getCurrentUser()?.uid;
      
      // Clear FCM token if needed
      const fcmToken = await AsyncStorage.getItem('fcmToken');
      if (userId && fcmToken) {
        await this.firestore().collection('users').doc(userId).update({
          fcmTokens: firestore.FieldValue.arrayRemove(fcmToken)
        });
      }
      
      // Sign out
      await this.auth().signOut();
      
      // Create audit log
      if (userId) {
        await SecurityUtils.createAuditLog(
          userId,
          'sign_out',
          { platform: Platform.OS }
        );
      }
    } catch (error) {
      console.error('Sign out error:', error);
      throw new Error('Failed to sign out. Please try again.');
    }
  }

  /**
   * Reset user password
   * 
   * @param {string} email - User email
   * @returns {Promise<void>}
   */
  async resetPassword(email) {
    try {
      await this.auth().sendPasswordResetEmail(email);
    } catch (error) {
      console.error('Reset password error:', error);
      
      switch (error.code) {
        case 'auth/invalid-email':
          throw new Error('Invalid email address');
        case 'auth/user-not-found':
          throw new Error('No account found with this email');
        default:
          throw new Error('Failed to send password reset email');
      }
    }
  }

  /**
   * Upload an image to Firebase Storage
   * 
   * @param {string} uri - Local image URI
   * @param {string} path - Storage path
   * @param {Object} metadata - Optional metadata
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} Download URL
   */
  async uploadImage(uri, path, metadata = {}, onProgress = null) {
    try {
      const reference = this.storage().ref(path);
      
      // Create upload task
      const task = reference.putFile(uri, metadata);
      
      // Monitor progress if callback provided
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
      console.error('Upload image error:', error);
      throw new Error('Failed to upload image. Please try again.');
    }
  }

  /**
   * Upload a profile image
   * 
   * @param {string} uri - Local image URI
   * @param {string} userId - User ID
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} Download URL
   */
  async uploadProfileImage(uri, userId, onProgress = null) {
    const extension = uri.split('.').pop();
    const path = `profiles/${userId}_${Date.now()}.${extension}`;
    
    return this.uploadImage(uri, path, { contentType: `image/${extension}` }, onProgress);
  }

  /**
   * Delete a file from Firebase Storage
   * 
   * @param {string} url - File URL or path
   * @returns {Promise<void>}
   */
  async deleteFile(url) {
    try {
      // Check if URL or path was provided
      let reference;
      
      if (url.startsWith('gs://') || !url.includes('://')) {
        // Path or gs:// URL
        reference = this.storage().ref(url);
      } else {
        // HTTP URL - need to extract path
        const decodedUrl = decodeURIComponent(url);
        const startIndex = decodedUrl.indexOf('/o/') + 3;
        const endIndex = decodedUrl.indexOf('?');
        const path = startIndex > 0 && endIndex > 0 
          ? decodedUrl.substring(startIndex, endIndex) 
          : url;
        
        reference = this.storage().ref(path);
      }
      
      await reference.delete();
    } catch (error) {
      console.error('Delete file error:', error);
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Create a new post in Firestore
   * 
   * @param {Object} postData - Post data
   * @returns {Promise<string>} Post ID
   */
  async createPost(postData) {
    try {
      // Sanitize input
      const sanitizedData = {
        ...postData,
        caption: SecurityUtils.sanitizeInput(postData.caption || ''),
      };
      
      // Add timestamps and initialize counters
      sanitizedData.timestamp = firestore.FieldValue.serverTimestamp();
      sanitizedData.likeCount = 0;
      sanitizedData.commentCount = 0;
      sanitizedData.likes = [];
      
      // Add post to Firestore
      const postRef = await this.firestore().collection('posts').add(sanitizedData);
      
      // Create audit log
      await SecurityUtils.createAuditLog(
        sanitizedData.userId,
        'post_created',
        { postId: postRef.id, postType: sanitizedData.type }
      );
      
      return postRef.id;
    } catch (error) {
      console.error('Create post error:', error);
      throw new Error('Failed to create post. Please try again.');
    }
  }

  /**
   * Get post by ID
   * 
   * @param {string} postId - Post ID
   * @returns {Promise<Object>} Post data
   */
  async getPost(postId) {
    try {
      const postDoc = await this.firestore().collection('posts').doc(postId).get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      return {
        id: postDoc.id,
        ...postDoc.data(),
        timestamp: postDoc.data().timestamp?.toDate() || new Date()
      };
    } catch (error) {
      console.error('Get post error:', error);
      throw error;
    }
  }

  /**
   * Get feed posts
   * 
   * @param {string} userId - User ID
   * @param {Array} blockedUsers - Blocked user IDs
   * @param {number} limit - Maximum number of posts
   * @param {Object} lastDoc - Last document for pagination
   * @returns {Promise<Array>} Feed posts
   */
  async getFeedPosts(userId, blockedUsers = [], limit = 10, lastDoc = null) {
    try {
      // Get user connections
      const connectionsSnapshot = await this.firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .get();
      
      // Extract connected user IDs
      const connectedUserIds = connectionsSnapshot.docs
        .map(doc => doc.data().connectedUserId)
        .filter(id => !blockedUsers.includes(id));
      
      // Include current user's ID
      const allUserIds = [...connectedUserIds, userId];
      
      // Firestore 'in' operator supports up to 10 values
      let query;
      
      if (allUserIds.length <= 10) {
        query = this.firestore()
          .collection('posts')
          .where('userId', 'in', allUserIds.length > 0 ? allUserIds : [userId])
          .orderBy('timestamp', 'desc')
          .limit(limit);
          
        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }
        
        const postsSnapshot = await query.get();
        
        return postsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));
      } else {
        // For more than 10 users, use a different approach
        // First get current user's posts
        const userPostsQuery = this.firestore()
          .collection('posts')
          .where('userId', '==', userId)
          .orderBy('timestamp', 'desc')
          .limit(limit / 2);
          
        if (lastDoc) {
          userPostsQuery = userPostsQuery.startAfter(lastDoc);
        }
        
        const userPostsSnapshot = await userPostsQuery.get();
        
        // Then get recent posts from all users
        const recentPostsQuery = this.firestore()
          .collection('posts')
          .orderBy('timestamp', 'desc')
          .limit(limit);
          
        if (lastDoc) {
          recentPostsQuery = recentPostsQuery.startAfter(lastDoc);
        }
        
        const recentPostsSnapshot = await recentPostsQuery.get();
        
        // Filter to only include connected users' posts
        const connectedPosts = recentPostsSnapshot.docs
          .filter(doc => connectedUserIds.includes(doc.data().userId))
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          }));
        
        // Combine user's posts with connected users' posts
        const userPosts = userPostsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));
        
        // Combine and sort all posts by timestamp
        const allPosts = [...userPosts, ...connectedPosts]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
          
        return allPosts;
      }
    } catch (error) {
      console.error('Get feed posts error:', error);
      throw error;
    }
  }

  /**
   * Toggle like on a post
   * 
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} New like state
   */
  async toggleLike(postId, userId) {
    try {
      const postRef = this.firestore().collection('posts').doc(postId);
      
      return await this.firestore().runTransaction(async transaction => {
        const postDoc = await transaction.get(postRef);
        
        if (!postDoc.exists) {
          throw new Error('Post not found');
        }
        
        const postData = postDoc.data();
        const likes = postData.likes || [];
        const userLiked = likes.includes(userId);
        
        if (userLiked) {
          // Remove like
          transaction.update(postRef, {
            likes: firestore.FieldValue.arrayRemove(userId),
            likeCount: firestore.FieldValue.increment(-1)
          });
          return false; // Not liked
        } else {
          // Add like
          transaction.update(postRef, {
            likes: firestore.FieldValue.arrayUnion(userId),
            likeCount: firestore.FieldValue.increment(1)
          });
          
          // Create notification for post author if not the same user
          if (postData.userId !== userId) {
            const userDoc = await this.firestore().collection('users').doc(userId).get();
            const userData = userDoc.data();
            const userFullName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'Someone';
            
            const notificationRef = this.firestore().collection('notifications').doc();
            transaction.set(notificationRef, {
              type: 'like',
              senderId: userId,
              senderName: userFullName,
              senderProfileImage: userData?.profileImageURL || null,
              recipientId: postData.userId,
              postId: postId,
              message: 'liked your post',
              timestamp: firestore.FieldValue.serverTimestamp(),
              read: false
            });
          }
          
          return true; // Liked
        }
      });
    } catch (error) {
      console.error('Toggle like error:', error);
      throw error;
    }
  }

  /**
   * Delete a post
   * 
   * @param {string} postId - Post ID
   * @param {string} userId - User ID (for permission check)
   * @returns {Promise<void>}
   */
  async deletePost(postId, userId) {
    try {
      // Get post to check ownership
      const postDoc = await this.firestore().collection('posts').doc(postId).get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      const postData = postDoc.data();
      
      // Check if user has permission
      const hasPermission = await SecurityUtils.hasPermission('post.delete', {
        id: postId,
        userId: postData.userId
      });
      
      if (!hasPermission) {
        throw new Error('You do not have permission to delete this post');
      }
      
      // Check if post has media content that needs deletion
      if (postData.content && (postData.type === 'image' || postData.type === 'video')) {
        try {
          await this.deleteFile(postData.content);
        } catch (err) {
          console.error('Error deleting post media:', err);
          // Continue with post deletion even if media deletion fails
        }
      }
      
      // Get all comments to delete
      const commentsSnapshot = await this.firestore()
        .collection('comments')
        .where('postId', '==', postId)
        .get();
      
      // Use a batch for atomic operation
      const batch = this.firestore().batch();
      
      // Delete the post
      batch.delete(this.firestore().collection('posts').doc(postId));
      
      // Delete all comments
      commentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Commit the batch
      await batch.commit();
      
      // Create audit log
      await SecurityUtils.createAuditLog(
        userId,
        'post_deleted',
        { postId, postType: postData.type }
      );
    } catch (error) {
      console.error('Delete post error:', error);
      throw error;
    }
  }

  /**
   * Add a comment to a post
   * 
   * @param {Object} commentData - Comment data
   * @returns {Promise<string>} Comment ID
   */
  async addComment(commentData) {
    try {
      // Sanitize comment text
      const sanitizedData = {
        ...commentData,
        text: SecurityUtils.sanitizeInput(commentData.text)
      };
      
      // Start a transaction to update both comment and post atomically
      const commentId = await this.firestore().runTransaction(async transaction => {
        // Add the comment
        const commentRef = this.firestore().collection('comments').doc();
        
        transaction.set(commentRef, {
          ...sanitizedData,
          timestamp: firestore.FieldValue.serverTimestamp(),
          edited: false
        });
        
        // Update comment count on the post
        const postRef = this.firestore().collection('posts').doc(commentData.postId);
        transaction.update(postRef, {
          commentCount: firestore.FieldValue.increment(1)
        });
        
        // Get post data for notification
        const postDoc = await transaction.get(postRef);
        const postData = postDoc.data();
        
        // Create notification for post author if not the same user
        if (postData && postData.userId !== sanitizedData.userId) {
          const notificationRef = this.firestore().collection('notifications').doc();
          transaction.set(notificationRef, {
            type: 'comment',
            senderId: sanitizedData.userId,
            senderName: sanitizedData.userFullName,
            senderProfileImage: sanitizedData.userProfileImageURL,
            recipientId: postData.userId,
            postId: sanitizedData.postId,
            message: 'commented on your post',
            timestamp: firestore.FieldValue.serverTimestamp(),
            read: false
          });
        }
        
        return commentRef.id;
      });
      
      return commentId;
    } catch (error) {
      console.error('Add comment error:', error);
      throw error;
    }
  }

  /**
   * Update a comment
   * 
   * @param {string} commentId - Comment ID
   * @param {string} text - Updated comment text
   * @param {string} userId - User ID (for permission check)
   * @returns {Promise<void>}
   */
  async updateComment(commentId, text, userId) {
    try {
      // Get comment to check ownership
      const commentDoc = await this.firestore().collection('comments').doc(commentId).get();
      
      if (!commentDoc.exists) {
        throw new Error('Comment not found');
      }
      
      const commentData = commentDoc.data();
      
      // Check if user has permission
      const hasPermission = await SecurityUtils.hasPermission('comment.edit', {
        id: commentId,
        userId: commentData.userId
      });
      
      if (!hasPermission) {
        throw new Error('You do not have permission to edit this comment');
      }
      
      // Sanitize text
      const sanitizedText = SecurityUtils.sanitizeInput(text);
      
      // Update comment
      await this.firestore().collection('comments').doc(commentId).update({
        text: sanitizedText,
        edited: true,
        editTimestamp: firestore.FieldValue.serverTimestamp()
      });
      
      // Create audit log
      await SecurityUtils.createAuditLog(
        userId,
        'comment_updated',
        { commentId }
      );
    } catch (error) {
      console.error('Update comment error:', error);
      throw error;
    }
  }

  /**
   * Delete a comment
   * 
   * @param {string} commentId - Comment ID
   * @param {string} postId - Post ID
   * @param {string} userId - User ID (for permission check)
   * @returns {Promise<void>}
   */
  async deleteComment(commentId, postId, userId) {
    try {
      // Get comment to check ownership
      const commentDoc = await this.firestore().collection('comments').doc(commentId).get();
      
      if (!commentDoc.exists) {
        throw new Error('Comment not found');
      }
      
      const commentData = commentDoc.data();
      
      // Check if user has permission
      const hasPermission = await SecurityUtils.hasPermission('comment.delete', {
        id: commentId,
        userId: commentData.userId
      });
      
      if (!hasPermission) {
        throw new Error('You do not have permission to delete this comment');
      }
      
      // Start a transaction to update both comment and post atomically
      await this.firestore().runTransaction(async transaction => {
        // Delete the comment
        const commentRef = this.firestore().collection('comments').doc(commentId);
        transaction.delete(commentRef);
        
        // Decrement comment count on the post
        const postRef = this.firestore().collection('posts').doc(postId);
        transaction.update(postRef, {
          commentCount: firestore.FieldValue.increment(-1)
        });
      });
      
      // Create audit log
      await SecurityUtils.createAuditLog(
        userId,
        'comment_deleted',
        { commentId, postId }
      );
    } catch (error) {
      console.error('Delete comment error:', error);
      throw error;
    }
  }

  /**
   * Get comments for a post
   * 
   * @param {string} postId - Post ID
   * @param {Array} blockedUsers - Blocked user IDs
   * @param {number} limit - Maximum number of comments
   * @param {Object} lastDoc - Last document for pagination
   * @returns {Promise<Array>} Post comments
   */
  async getComments(postId, blockedUsers = [], limit = 20, lastDoc = null) {
    try {
      let query = this.firestore()
        .collection('comments')
        .where('postId', '==', postId)
        .orderBy('timestamp', 'asc')
        .limit(limit);
        
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const commentsSnapshot = await query.get();
      
      // Filter out comments from blocked users
      return commentsSnapshot.docs
        .filter(doc => !blockedUsers.includes(doc.data().userId))
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
          editTimestamp: doc.data().editTimestamp?.toDate() || null
        }));
    } catch (error) {
      console.error('Get comments error:', error);
      throw error;
    }
  }

  /**
   * Register device for push notifications
   * 
   * @param {string} userId - User ID
   * @returns {Promise<string>} FCM token
   */
  async registerForPushNotifications(userId) {
    try {
      // Check permissions
      const authStatus = await this.messaging().requestPermission();
      const enabled = 
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        
      if (!enabled) {
        throw new Error('Notification permission denied');
      }
      
      // Register device with FCM
      await this.messaging().registerDeviceForRemoteMessages();
      
      // Get FCM token
      const token = await this.messaging().getToken();
      
      // Save token to user document
      await this.firestore().collection('users').doc(userId).update({
        fcmTokens: firestore.FieldValue.arrayUnion(token),
        lastTokenUpdate: firestore.FieldValue.serverTimestamp()
      });
      
      // Save token locally
      await AsyncStorage.setItem('fcmToken', token);
      
      return token;
    } catch (error) {
      console.error('Register for push notifications error:', error);
      throw error;
    }
  }

  /**
   * Create a notification in Firestore
   * 
   * @param {Object} notificationData - Notification data
   * @returns {Promise<string>} Notification ID
   */
  async createNotification(notificationData) {
    try {
      const notificationRef = await this.firestore().collection('notifications').add({
        ...notificationData,
        timestamp: firestore.FieldValue.serverTimestamp(),
        read: false
      });
      
      return notificationRef.id;
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * 
   * @param {string} userId - User ID
   * @param {Array} blockedUsers - Blocked user IDs
   * @param {number} limit - Maximum number of notifications
   * @param {Object} lastDoc - Last document for pagination
   * @returns {Promise<Array>} User notifications
   */
  async getNotifications(userId, blockedUsers = [], limit = 20, lastDoc = null) {
    try {
      let query = this.firestore()
        .collection('notifications')
        .where('recipientId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit);
        
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const notificationsSnapshot = await query.get();
      
      // Filter out notifications from blocked users
      return notificationsSnapshot.docs
        .filter(doc => !blockedUsers.includes(doc.data().senderId))
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));
    } catch (error) {
      console.error('Get notifications error:', error);
      throw error;
    }
  }

  /**
   * Mark notifications as read
   * 
   * @param {Array} notificationIds - Notification IDs
   * @returns {Promise<void>}
   */
  async markNotificationsAsRead(notificationIds) {
    try {
      // Use batched writes for better performance
      const batch = this.firestore().batch();
      
      notificationIds.forEach(id => {
        const notificationRef = this.firestore().collection('notifications').doc(id);
        batch.update(notificationRef, { read: true });
      });
      
      return await batch.commit();
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  }

  /**
   * Follow/connect with another user
   * 
   * @param {string} userId - Current user ID
   * @param {string} targetUserId - User to follow
   * @returns {Promise<string>} Connection document ID
   */
  async followUser(userId, targetUserId) {
    try {
      // Check if already following
      const connectionQuery = await this.firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .where('connectedUserId', '==', targetUserId)
        .get();
      
      if (!connectionQuery.empty) {
        throw new Error('Already following this user');
      }
      
      // Create connection
      const connectionRef = await this.firestore().collection('connections').add({
        userId: userId,
        connectedUserId: targetUserId,
        timestamp: firestore.FieldValue.serverTimestamp()
      });
      
      // Create notification for target user
      const userDoc = await this.firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      const userFullName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'Someone';
      
      await this.createNotification({
        type: 'follow',
        senderId: userId,
        senderName: userFullName,
        senderProfileImage: userData.profileImageURL,
        recipientId: targetUserId,
        message: 'started following you',
        timestamp: firestore.FieldValue.serverTimestamp(),
        read: false
      });
      
      return connectionRef.id;
    } catch (error) {
      console.error('Follow user error:', error);
      throw error;
    }
  }

  /**
   * Unfollow/disconnect from a user
   * 
   * @param {string} userId - Current user ID
   * @param {string} targetUserId - User to unfollow
   * @returns {Promise<void>}
   */
  async unfollowUser(userId, targetUserId) {
    try {
      const connectionQuery = await this.firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .where('connectedUserId', '==', targetUserId)
        .get();
      
      if (connectionQuery.empty) {
        throw new Error('Not following this user');
      }
      
      // Delete connection
      await connectionQuery.docs[0].ref.delete();
      
      // Create audit log
      await SecurityUtils.createAuditLog(
        userId,
        'user_unfollowed',
        { targetUserId }
      );
    } catch (error) {
      console.error('Unfollow user error:', error);
      throw error;
    }
  }

  /**
   * Block a user
   * 
   * @param {string} userId - Current user ID
   * @param {string} blockedUserId - User ID to block
   * @param {string} reason - Optional reason for blocking
   * @returns {Promise<string>} Block document ID
   */
  async blockUser(userId, blockedUserId, reason = '') {
    try {
      // Check if already blocked
      const blockQuery = await this.firestore()
        .collection('blockedUsers')
        .where('blockedBy', '==', userId)
        .where('blockedUserId', '==', blockedUserId)
        .get();
      
      if (!blockQuery.empty) {
        throw new Error('User is already blocked');
      }
      
      // Add to blocked users collection
      const blockRef = await this.firestore().collection('blockedUsers').add({
        blockedBy: userId,
        blockedUserId: blockedUserId,
        reason: SecurityUtils.sanitizeInput(reason),
        timestamp: firestore.FieldValue.serverTimestamp()
      });
      
      // Also unfollow the user if currently following
      try {
        await this.unfollowUser(userId, blockedUserId);
      } catch (error) {
        // Ignore error if not following
        console.log('Not following blocked user:', error.message);
      }
      
      // Create audit log
      await SecurityUtils.createAuditLog(
        userId,
        'user_blocked',
        { blockedUserId, reason }
      );
      
      return blockRef.id;
    } catch (error) {
      console.error('Block user error:', error);
      throw error;
    }
  }

  /**
   * Unblock a user
   * 
   * @param {string} userId - Current user ID
   * @param {string} blockedUserId - User ID to unblock
   * @returns {Promise<void>}
   */
  async unblockUser(userId, blockedUserId) {
    try {
      const blockQuery = await this.firestore()
        .collection('blockedUsers')
        .where('blockedBy', '==', userId)
        .where('blockedUserId', '==', blockedUserId)
        .get();
      
      if (blockQuery.empty) {
        throw new Error('User is not blocked');
      }
      
      // Delete from blocked users collection
      await blockQuery.docs[0].ref.delete();
      
      // Create audit log
      await SecurityUtils.createAuditLog(
        userId,
        'user_unblocked',
        { blockedUserId }
      );
    } catch (error) {
      console.error('Unblock user error:', error);
      throw error;
    }
  }

  /**
   * Get blocked users
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Blocked user IDs
   */
  async getBlockedUsers(userId) {
    try {
      const blockQuery = await this.firestore()
        .collection('blockedUsers')
        .where('blockedBy', '==', userId)
        .get();
      
      return blockQuery.docs.map(doc => doc.data().blockedUserId);
    } catch (error) {
      console.error('Get blocked users error:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about blocked users
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Blocked user details
   */
  async getBlockedUserDetails(userId) {
    try {
      // Get block records
      const blockQuery = await this.firestore()
        .collection('blockedUsers')
        .where('blockedBy', '==', userId)
        .get();
      
      if (blockQuery.empty) {
        return [];
      }
      
      // Extract blocked user IDs
      const blockedUserIds = blockQuery.docs.map(doc => doc.data().blockedUserId);
      
      // Create a map of block records by blockedUserId
      const blockRecords = {};
      blockQuery.docs.forEach(doc => {
        const data = doc.data();
        blockRecords[data.blockedUserId] = {
          id: doc.id,
          reason: data.reason,
          timestamp: data.timestamp?.toDate() || new Date()
        };
      });
      
      // Get user details (in chunks of 10 due to Firestore 'in' limit)
      const userDetails = [];
      
      for (let i = 0; i < blockedUserIds.length; i += 10) {
        const chunk = blockedUserIds.slice(i, i + 10);
        
        if (chunk.length > 0) {
          const usersQuery = await this.firestore()
            .collection('users')
            .where(firestore.FieldPath.documentId(), 'in', chunk)
            .get();
          
          usersQuery.docs.forEach(doc => {
            userDetails.push({
              id: doc.id,
              ...doc.data(),
              blockInfo: blockRecords[doc.id]
            });
          });
        }
      }
      
      return userDetails;
    } catch (error) {
      console.error('Get blocked user details error:', error);
      throw error;
    }
  }

  /**
   * Report inappropriate content
   * 
   * @param {string} contentType - Type of content (post, comment, user)
   * @param {string} contentId - ID of the content
   * @param {string} reporterId - User ID reporting the content
   * @param {string} reason - Reason for reporting
   * @returns {Promise<string>} Report ID
   */
  async reportContent(contentType, contentId, reporterId, reason) {
    try {
      // Sanitize reason
      const sanitizedReason = SecurityUtils.sanitizeInput(reason);
      
      // Add report to database
      const reportRef = await this.firestore().collection('reports').add({
        contentType,
        contentId,
        reporterId,
        reason: sanitizedReason,
        timestamp: firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });
      
      // Create audit log
      await SecurityUtils.createAuditLog(
        reporterId,
        'content_reported',
        { contentType, contentId, reason: sanitizedReason }
      );
      
      return reportRef.id;
    } catch (error) {
      console.error('Report content error:', error);
      throw error;
    }
  }

  /**
   * Search users by name or medical condition
   * 
   * @param {string} query - Search query
   * @param {string} filter - Optional filter (e.g. condition)
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Matching users
   */
  async searchUsers(query, filter = null, limit = 20) {
    try {
      let firestoreQuery;
      
      // If filtering by condition
      if (filter === 'condition' && query) {
        firestoreQuery = this.firestore()
          .collection('users')
          .where('medicalConditions', 'array-contains', query)
          .limit(limit);
      } else {
        // Basic implementation - in a real app, you might use Algolia or another search service
        firestoreQuery = this.firestore()
          .collection('users')
          .limit(limit);
      }
      
      const snapshot = await firestoreQuery.get();
      
      // If not filtering by condition, we need to filter client-side
      if (filter !== 'condition' && query) {
        const searchLower = query.toLowerCase();
        
        return snapshot.docs
          .filter(doc => {
            const data = doc.data();
            return (
              (data.firstName && data.firstName.toLowerCase().includes(searchLower)) ||
              (data.lastName && data.lastName.toLowerCase().includes(searchLower)) ||
              (data.email && data.email.toLowerCase().includes(searchLower)) ||
              (data.medicalConditions && data.medicalConditions.some(
                condition => condition.toLowerCase().includes(searchLower)
              ))
            );
          })
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            joinDate: doc.data().joinDate?.toDate() || null
          }));
      } else {
        // Just return all results if no query or already filtered by condition
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          joinDate: doc.data().joinDate?.toDate() || null
        }));
      }
    } catch (error) {
      console.error('Search users error:', error);
      throw error;
    }
  }

  /**
   * Find users with similar medical conditions
   * 
   * @param {Array} conditions - User's medical conditions
   * @param {Array} blockedUsers - Blocked user IDs
   * @param {number} limit - Maximum number of users to return
   * @returns {Promise<Array>} Similar users
   */
  async findUsersBySimilarConditions(conditions, blockedUsers = [], limit = 20) {
    try {
      if (!conditions || conditions.length === 0) {
        return [];
      }
      
      const usersSnapshot = await this.firestore()
        .collection('users')
        .where('medicalConditions', 'array-contains-any', conditions)
        .limit(limit + blockedUsers.length) // Fetch extra to account for filtering
        .get();
      
      // Get current user ID
      const currentUserId = this.getCurrentUser()?.uid;
      
      // Filter out blocked users and current user
      let users = usersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(user => 
          !blockedUsers.includes(user.id) && 
          user.id !== currentUserId
        );
      
      // Sort by number of shared conditions (descending)
      users.sort((a, b) => {
        const sharedWithA = a.medicalConditions.filter(
          condition => conditions.includes(condition)
        ).length;
        
        const sharedWithB = b.medicalConditions.filter(
          condition => conditions.includes(condition)
        ).length;
        
        return sharedWithB - sharedWithA;
      });
      
      // Apply limit after sorting
      return users.slice(0, limit);
    } catch (error) {
      console.error('Find users by conditions error:', error);
      throw error;
    }
  }

  /**
   * Get or create a conversation between two users
   * 
   * @param {string} userId - Current user ID
   * @param {string} otherUserId - Other participant ID
   * @returns {Promise<Object>} Conversation data
   */
  async getOrCreateConversation(userId, otherUserId) {
    try {
      // Check if conversation already exists
      const snapshot = await this.firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .get();
      
      // Find conversation with both participants
      const existingConversation = snapshot.docs.find(doc => {
        const participants = doc.data().participants || [];
        return participants.includes(otherUserId);
      });
      
      if (existingConversation) {
        return {
          id: existingConversation.id,
          ...existingConversation.data(),
          lastMessageTimestamp: existingConversation.data().lastMessageTimestamp?.toDate() || null,
        };
      }
      
      // Get user data for both participants
      const [currentUserDoc, otherUserDoc] = await Promise.all([
        this.firestore().collection('users').doc(userId).get(),
        this.firestore().collection('users').doc(otherUserId).get(),
      ]);
      
      if (!otherUserDoc.exists) {
        throw new Error('User not found');
      }
      
      const currentUserData = currentUserDoc.data();
      const otherUserData = otherUserDoc.data();
      
      // Create new conversation
      const conversationRef = await this.firestore().collection('conversations').add({
        participants: [userId, otherUserId],
        participantsData: {
          [userId]: {
            id: userId,
            name: `${currentUserData.firstName || ''} ${currentUserData.lastName || ''}`.trim(),
            profileImage: currentUserData.profileImageURL,
          },
          [otherUserId]: {
            id: otherUserId,
            name: `${otherUserData.firstName || ''} ${otherUserData.lastName || ''}`.trim(),
            profileImage: otherUserData.profileImageURL,
          },
        },
        created: firestore.FieldValue.serverTimestamp(),
        lastMessageTimestamp: null,
      });
      
      return {
        id: conversationRef.id,
        participants: [userId, otherUserId],
        participantsData: {
          [userId]: {
            id: userId,
            name: `${currentUserData.firstName || ''} ${currentUserData.lastName || ''}`.trim(),
            profileImage: currentUserData.profileImageURL,
          },
          [otherUserId]: {
            id: otherUserId,
            name: `${otherUserData.firstName || ''} ${otherUserData.lastName || ''}`.trim(),
            profileImage: otherUserData.profileImageURL,
          },
        },
        created: new Date(),
        lastMessageTimestamp: null,
      };
    } catch (error) {
      console.error('Get or create conversation error:', error);
      throw error;
    }
  }

  /**
   * Send a message in a conversation
   * 
   * @param {string} conversationId - Conversation ID
   * @param {Object} messageData - Message data
   * @returns {Promise<string>} Message ID
   */
  async sendMessage(conversationId, messageData) {
    try {
      const { text, senderId, recipientId } = messageData;
      
      // Sanitize message text
      const sanitizedText = SecurityUtils.sanitizeInput(text);
      
      // Get sender and recipient data
      const [senderDoc, recipientDoc] = await Promise.all([
        this.firestore().collection('users').doc(senderId).get(),
        this.firestore().collection('users').doc(recipientId).get(),
      ]);
      
      const senderData = senderDoc.data();
      const recipientData = recipientDoc.data();
      
      // Add message to conversation
      const messageRef = await this.firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .add({
          text: sanitizedText,
          senderId,
          senderName: `${senderData.firstName || ''} ${senderData.lastName || ''}`.trim(),
          senderProfileImage: senderData.profileImageURL,
          recipientId,
          recipientName: `${recipientData.firstName || ''} ${recipientData.lastName || ''}`.trim(),
          timestamp: firestore.FieldValue.serverTimestamp(),
          read: false,
        });
      
      // Update conversation with last message info
      await this.firestore()
        .collection('conversations')
        .doc(conversationId)
        .update({
          lastMessage: sanitizedText,
          lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
          lastMessageSenderId: senderId,
          [`unreadCount.${recipientId}`]: firestore.FieldValue.increment(1),
        });
      
      // Create notification for recipient
      await this.createNotification({
        type: 'message',
        senderId,
        senderName: `${senderData.firstName || ''} ${senderData.lastName || ''}`.trim(),
        senderProfileImage: senderData.profileImageURL,
        recipientId,
        conversationId,
        message: 'sent you a message',
        preview: sanitizedText.substring(0, 50) + (sanitizedText.length > 50 ? '...' : ''),
        timestamp: firestore.FieldValue.serverTimestamp(),
        read: false,
      });
      
      return messageRef.id;
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  }

  /**
   * Mark all messages in a conversation as read
   * 
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of messages marked as read
   */
  async markConversationAsRead(conversationId, userId) {
    try {
      // Get unread messages sent to this user
      const messagesSnapshot = await this.firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('recipientId', '==', userId)
        .where('read', '==', false)
        .get();
      
      if (messagesSnapshot.empty) {
        return 0;
      }
      
      // Mark all as read
      const batch = this.firestore().batch();
      messagesSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
      });
      
      // Reset unread count for this user
      batch.update(
        this.firestore().collection('conversations').doc(conversationId),
        { [`unreadCount.${userId}`]: 0 }
      );
      
      await batch.commit();
      return messagesSnapshot.docs.length;
    } catch (error) {
      console.error('Mark conversation as read error:', error);
      throw error;
    }
  }
}

// Create singleton instance
const firebaseUtils = new FirebaseUtils();

export default firebaseUtils;
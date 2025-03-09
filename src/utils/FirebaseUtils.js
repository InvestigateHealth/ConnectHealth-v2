// src/utils/FirebaseUtils.js
// Utility functions for Firebase operations

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import SecurityUtils from './SecurityUtils';
import { sanitizeInput } from './validationUtils';

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
    this.isConnected = true;

    // Initialize network listener
    this.initNetworkListener();

    // Initialize current user
    this.auth().onAuthStateChanged(user => {
      this.currentUser = user;
    });
  }

  /**
   * Initialize network connectivity listener
   */
  initNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isConnected = state.isConnected;
      if (!state.isConnected) {
        console.log('Network is disconnected. Firebase operations may fail.');
      }
    });
  }

  /**
   * Check if network is connected
   * 
   * @returns {Promise<boolean>} Whether network is connected
   */
  async checkConnection() {
    try {
      const state = await NetInfo.fetch();
      this.isConnected = state.isConnected;
      return state.isConnected;
    } catch (error) {
      console.error('Error checking network connection:', error);
      return this.isConnected; // Use cached value
    }
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
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
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
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!userData || typeof userData !== 'object') {
        throw new Error('User data must be an object');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      // Sanitize data before saving
      const sanitizedData = {};
      
      for (const [key, value] of Object.entries(userData)) {
        // Sanitize strings to prevent XSS
        if (typeof value === 'string') {
          sanitizedData[key] = sanitizeInput(value);
        } else {
          sanitizedData[key] = value;
        }
      }
      
      // Add timestamp if creating new document
      if (!merge) {
        sanitizedData.joinDate = firestore.FieldValue.serverTimestamp();
        sanitizedData.lastUpdated = firestore.FieldValue.serverTimestamp();
      } else {
        sanitizedData.lastUpdated = firestore.FieldValue.serverTimestamp();
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
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates must be an object');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      const sanitizedUpdates = {};
      
      // Sanitize input data
      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === 'string') {
          sanitizedUpdates[key] = sanitizeInput(value);
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
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
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
        case 'auth/too-many-requests':
          throw new Error('Too many failed attempts. Please try again later.');
        case 'auth/network-request-failed':
          throw new Error('Network error. Please check your connection and try again.');
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
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      // Check for disposable email 
      if (SecurityUtils.isDisposableEmail(email)) {
        throw new Error('Please use a non-disposable email address');
      }

      // Create user account
      const userCredential = await this.auth().createUserWithEmailAndPassword(email, password);
      
      try {
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
      } catch (profileError) {
        console.error('Error creating user profile:', profileError);
        // Continue with user creation even if profile creation fails
        // We can try to create the profile again later
      }
      
      // Create audit log
      try {
        await SecurityUtils.createAuditLog(
          userCredential.user.uid,
          'account_created',
          { email, platform: Platform.OS }
        );
      } catch (auditError) {
        console.error('Error creating audit log:', auditError);
        // Non-critical, continue
      }
      
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
      // Check network connectivity - we allow signout even if offline
      const isConnected = await this.checkConnection();
      
      // Get user ID before signing out for audit log
      const userId = this.getCurrentUser()?.uid;
      
      // Clear FCM token if needed and if online
      if (isConnected && userId) {
        try {
          const fcmToken = await AsyncStorage.getItem('fcmToken');
          if (fcmToken) {
            await this.firestore().collection('users').doc(userId).update({
              fcmTokens: firestore.FieldValue.arrayRemove(fcmToken)
            });
          }
        } catch (tokenError) {
          console.error('Error clearing FCM token:', tokenError);
          // Continue sign out process even if token removal fails
        }
      }
      
      // Sign out
      await this.auth().signOut();
      
      // Create audit log if online
      if (isConnected && userId) {
        try {
          await SecurityUtils.createAuditLog(
            userId,
            'sign_out',
            { platform: Platform.OS }
          );
        } catch (auditError) {
          console.error('Error creating audit log:', auditError);
          // Non-critical, continue
        }
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
      if (!email) {
        throw new Error('Email is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
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
      if (!uri) {
        throw new Error('Image URI is required');
      }
      
      if (!path) {
        throw new Error('Storage path is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      const reference = this.storage().ref(path);
      
      // Create upload task
      const task = reference.putFile(uri, metadata);
      
      // Monitor progress if callback provided
      if (onProgress && typeof onProgress === 'function') {
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
    if (!uri) {
      throw new Error('Image URI is required');
    }
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
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
      if (!url) {
        throw new Error('File URL or path is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
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
      if (!postData || typeof postData !== 'object') {
        throw new Error('Post data is required');
      }
      
      if (!postData.userId) {
        throw new Error('User ID is required for post');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      // Sanitize input
      const sanitizedData = {
        ...postData,
        caption: sanitizeInput(postData.caption || ''),
      };
      
      // Add timestamps and initialize counters
      sanitizedData.timestamp = firestore.FieldValue.serverTimestamp();
      sanitizedData.lastUpdated = firestore.FieldValue.serverTimestamp();
      sanitizedData.likeCount = 0;
      sanitizedData.commentCount = 0;
      sanitizedData.likes = [];
      
      // Add post to Firestore
      const postRef = await this.firestore().collection('posts').add(sanitizedData);
      
      // Create audit log
      try {
        await SecurityUtils.createAuditLog(
          sanitizedData.userId,
          'post_created',
          { postId: postRef.id, postType: sanitizedData.type }
        );
      } catch (auditError) {
        console.error('Error creating audit log:', auditError);
        // Non-critical, continue
      }
      
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
      if (!postId) {
        throw new Error('Post ID is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
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
   * Get feed posts with improved pagination and handling of large user networks
   * 
   * @param {string} userId - User ID
   * @param {Array} blockedUsers - Blocked user IDs
   * @param {number} limit - Maximum number of posts
   * @param {Object} lastDoc - Last document for pagination
   * @returns {Promise<Object>} Feed posts and pagination info
   */
  async getFeedPosts(userId, blockedUsers = [], limit = 10, lastDoc = null) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
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
      const relevantUserIds = [userId, ...connectedUserIds].filter(id => 
        !blockedUsers.includes(id)
      );
      
      // Use batching approach for larger networks
      const batchSize = 10; // Firestore 'in' clause limit
      let allPosts = [];
      let lastDocFromBatch = null;
      
      // Split user IDs into batches of 10 or fewer
      for (let i = 0; i < relevantUserIds.length; i += batchSize) {
        const batchUserIds = relevantUserIds.slice(i, i + batchSize);
        
        let query = this.firestore()
          .collection('posts')
          .where('userId', 'in', batchUserIds)
          .orderBy('timestamp', 'desc');
        
        // Apply pagination for first batch only
        if (i === 0 && lastDoc) {
          query = query.startAfter(lastDoc);
        }
        
        // Limit to double the requested amount for this batch
        // This helps ensure we have enough posts across all batches
        query = query.limit(limit * 2);
        
        const batchSnapshot = await query.get();
        
        if (batchSnapshot.docs.length > 0) {
          // Save last doc from first batch for pagination
          if (i === 0) {
            lastDocFromBatch = batchSnapshot.docs[batchSnapshot.docs.length - 1];
          }
          
          // Map docs to posts
          const batchPosts = batchSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          }));
          
          allPosts = [...allPosts, ...batchPosts];
        }
        
        // If we already have enough posts, stop querying
        if (allPosts.length >= limit * 3) {
          break;
        }
      }
      
      // Sort all collected posts by timestamp
      allPosts.sort((a, b) => b.timestamp - a.timestamp);
      
      // Limit to requested number
      const limitedPosts = allPosts.slice(0, limit);
      
      return {
        posts: limitedPosts,
        lastDoc: lastDocFromBatch,
        hasMore: allPosts.length > limit
      };
    } catch (error) {
      console.error('Get feed posts error:', error);
      throw error;
    }
  }

  /**
   * Toggle like on a post with transaction for consistency
   * 
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} New like state
   */
  async toggleLike(postId, userId) {
    try {
      if (!postId) {
        throw new Error('Post ID is required');
      }
      
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
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
            likeCount: firestore.FieldValue.increment(-1),
            lastUpdated: firestore.FieldValue.serverTimestamp()
          });
          return false; // Not liked
        } else {
          // Add like
          transaction.update(postRef, {
            likes: firestore.FieldValue.arrayUnion(userId),
            likeCount: firestore.FieldValue.increment(1),
            lastUpdated: firestore.FieldValue.serverTimestamp()
          });
          
          // Create notification for post author if not the same user
          if (postData.userId !== userId) {
            try {
              const userDoc = await transaction.get(
                this.firestore().collection('users').doc(userId)
              );
              
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
            } catch (notificationError) {
              console.error('Error creating like notification:', notificationError);
              // Continue without notification on error
            }
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
   * Add comment to a post
   * 
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @param {string} text - Comment text
   * @returns {Promise<string>} Comment ID
   */
  async addComment(postId, userId, text) {
    try {
      if (!postId) {
        throw new Error('Post ID is required');
      }
      
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      if (!text || !text.trim()) {
        throw new Error('Comment text is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      // Get post to verify it exists and get author
      const postDoc = await this.firestore().collection('posts').doc(postId).get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      const postData = postDoc.data();
      
      // Create comment
      const commentRef = this.firestore().collection('comments').doc();
      const commentData = {
        postId,
        userId,
        text: sanitizeInput(text),
        timestamp: firestore.FieldValue.serverTimestamp(),
        likes: [],
        likeCount: 0
      };
      
      // Use a batch to ensure both operations succeed or fail together
      const batch = this.firestore().batch();
      
      // Add comment
      batch.set(commentRef, commentData);
      
      // Update post comment count
      const postRef = this.firestore().collection('posts').doc(postId);
      batch.update(postRef, {
        commentCount: firestore.FieldValue.increment(1),
        lastUpdated: firestore.FieldValue.serverTimestamp()
      });
      
      await batch.commit();
      
      // Create notification for post author if not the same user
      if (postData.userId !== userId) {
        try {
          const userDoc = await this.firestore().collection('users').doc(userId).get();
          const userData = userDoc.data();
          const userFullName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'Someone';
          
          await this.firestore().collection('notifications').add({
            type: 'comment',
            senderId: userId,
            senderName: userFullName,
            senderProfileImage: userData?.profileImageURL || null,
            recipientId: postData.userId,
            postId: postId,
            commentId: commentRef.id,
            message: 'commented on your post',
            preview: text.length > 50 ? text.substring(0, 47) + '...' : text,
            timestamp: firestore.FieldValue.serverTimestamp(),
            read: false
          });
        } catch (notificationError) {
          console.error('Error creating comment notification:', notificationError);
          // Continue without notification on error
        }
      }
      
      return commentRef.id;
    } catch (error) {
      console.error('Add comment error:', error);
      throw error;
    }
  }

  /**
   * Get comments for a post with pagination
   * 
   * @param {string} postId - Post ID
   * @param {number} limit - Maximum number of comments
   * @param {Object} lastDoc - Last document for pagination
   * @returns {Promise<Object>} Comments and pagination info
   */
  async getComments(postId, limit = 20, lastDoc = null) {
    try {
      if (!postId) {
        throw new Error('Post ID is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      let query = this.firestore()
        .collection('comments')
        .where('postId', '==', postId)
        .orderBy('timestamp', 'desc');
        
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      query = query.limit(limit);
      
      const commentsSnapshot = await query.get();
      
      const comments = commentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      
      return {
        comments,
        lastDoc: commentsSnapshot.docs.length > 0 ? 
          commentsSnapshot.docs[commentsSnapshot.docs.length - 1] : null,
        hasMore: commentsSnapshot.docs.length === limit
      };
    } catch (error) {
      console.error('Get comments error:', error);
      throw error;
    }
  }

  /**
   * Delete a post and all associated comments
   * 
   * @param {string} postId - Post ID
   * @param {string} userId - User ID (for permission check)
   * @returns {Promise<boolean>} Success status
   */
  async deletePost(postId, userId) {
    try {
      if (!postId) {
        throw new Error('Post ID is required');
      }
      
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      // Get post to verify ownership
      const postDoc = await this.firestore().collection('posts').doc(postId).get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      const postData = postDoc.data();
      
      // Check if user has permission
      const hasPermission = await SecurityUtils.hasPermission('post.delete', {
        userId: postData.userId,
        id: postId
      });
      
      if (!hasPermission && postData.userId !== userId) {
        throw new Error('You don\'t have permission to delete this post');
      }
      
      // Get post comments (batch size limited for large comment threads)
      const commentsSnapshot = await this.firestore()
        .collection('comments')
        .where('postId', '==', postId)
        .limit(500) // Firestore batch size limit is 500
        .get();
      
      // Use batched write for performance and consistency
      const batch = this.firestore().batch();
      
      // Delete all comments
      commentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Delete post
      batch.delete(this.firestore().collection('posts').doc(postId));
      
      await batch.commit();
      
      // If post had image or video, delete from storage
      if (postData.imageURL) {
        try {
          await this.deleteFile(postData.imageURL);
        } catch (storageError) {
          console.error('Error deleting post image:', storageError);
          // Continue anyway, post is deleted
        }
      }
      
      if (postData.videoURL) {
        try {
          await this.deleteFile(postData.videoURL);
        } catch (storageError) {
          console.error('Error deleting post video:', storageError);
          // Continue anyway, post is deleted
        }
      }
      
      // Create audit log
      try {
        await SecurityUtils.createAuditLog(
          userId,
          'post_deleted',
          { postId, postType: postData.type }
        );
      } catch (auditError) {
        console.error('Error creating audit log:', auditError);
        // Non-critical, continue
      }
      
      return true;
    } catch (error) {
      console.error('Delete post error:', error);
      throw error;
    }
  }

  /**
   * Block a user
   * 
   * @param {string} userId - Current user ID
   * @param {string} blockedUserId - ID of user to block
   * @returns {Promise<boolean>} Success status
   */
  async blockUser(userId, blockedUserId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      if (!blockedUserId) {
        throw new Error('Blocked user ID is required');
      }
      
      if (userId === blockedUserId) {
        throw new Error('You cannot block yourself');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      // Add to blocked users list
      await this.firestore().collection('users').doc(userId).update({
        blockedUsers: firestore.FieldValue.arrayUnion(blockedUserId),
        lastUpdated: firestore.FieldValue.serverTimestamp()
      });
      
      // Remove any connections between the users
      const connectionsQuery = this.firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .where('connectedUserId', '==', blockedUserId);
      
      const reverseConnectionsQuery = this.firestore()
        .collection('connections')
        .where('userId', '==', blockedUserId)
        .where('connectedUserId', '==', userId);
      
      const [connectionsSnapshot, reverseConnectionsSnapshot] = await Promise.all([
        connectionsQuery.get(),
        reverseConnectionsQuery.get()
      ]);
      
      // Use a batch to delete all connections
      const batch = this.firestore().batch();
      
      connectionsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      reverseConnectionsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      // Create audit log
      try {
        await SecurityUtils.createAuditLog(
          userId,
          'user_blocked',
          { blockedUserId }
        );
      } catch (auditError) {
        console.error('Error creating audit log:', auditError);
        // Non-critical, continue
      }
      
      return true;
    } catch (error) {
      console.error('Block user error:', error);
      throw error;
    }
  }

  /**
   * Unblock a user
   * 
   * @param {string} userId - Current user ID
   * @param {string} blockedUserId - ID of user to unblock
   * @returns {Promise<boolean>} Success status
   */
  async unblockUser(userId, blockedUserId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      if (!blockedUserId) {
        throw new Error('Blocked user ID is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        throw new Error('No internet connection. Please try again when online.');
      }
      
      // Remove from blocked users list
      await this.firestore().collection('users').doc(userId).update({
        blockedUsers: firestore.FieldValue.arrayRemove(blockedUserId),
        lastUpdated: firestore.FieldValue.serverTimestamp()
      });
      
      // Create audit log
      try {
        await SecurityUtils.createAuditLog(
          userId,
          'user_unblocked',
          { blockedUserId }
        );
      } catch (auditError) {
        console.error('Error creating audit log:', auditError);
        // Non-critical, continue
      }
      
      return true;
    } catch (error) {
      console.error('Unblock user error:', error);
      throw error;
    }
  }

  /**
   * Share post via platform sharing
   * 
   * @param {string} postId - Post ID
   * @param {string} shareType - Type of share (email, sms, etc)
   * @returns {Promise<Object>} Share info
   */
  async recordPostShare(postId, shareType) {
    try {
      if (!postId) {
        throw new Error('Post ID is required');
      }
      
      if (!shareType) {
        throw new Error('Share type is required');
      }
      
      const user = this.getCurrentUser();
      const userId = user ? user.uid : null;
      
      // Record share analytics even if offline
      // We'll sync this when back online
      const shareData = {
        postId,
        shareType,
        timestamp: firestore.FieldValue.serverTimestamp(),
        userId
      };
      
      // Try to update post in Firestore if online
      if (await this.checkConnection()) {
        // Update share count on the post
        await this.firestore().collection('posts').doc(postId).update({
          shareCount: firestore.FieldValue.increment(1),
          lastUpdated: firestore.FieldValue.serverTimestamp()
        });
        
        // Record share in analytics collection
        await this.firestore().collection('postShares').add(shareData);
      } else {
        // Store locally to sync later
        try {
          const pendingShares = JSON.parse(await AsyncStorage.getItem('pendingShares')) || [];
          pendingShares.push({
            ...shareData,
            timestamp: Date.now()
          });
          await AsyncStorage.setItem('pendingShares', JSON.stringify(pendingShares));
        } catch (storageError) {
          console.error('Error storing pending share:', storageError);
        }
      }
      
      return { success: true, postId, shareType };
    } catch (error) {
      console.error('Record post share error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const firebaseUtils = new FirebaseUtils();

export default firebaseUtils;
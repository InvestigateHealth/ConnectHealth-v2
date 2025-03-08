// src/utils/FirebaseUtils.js
// Utility functions for Firebase operations

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SecurityUtils from './SecurityUtils';
import { RNFS } from 'react-native-fs';

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
      if (!userId) {
        throw new Error('User ID is required');
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
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates must be an object');
      }
      
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
      if (!email || !password) {
        throw new Error('Email and password are required');
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
      try {
        const fcmToken = await AsyncStorage.getItem('fcmToken');
        if (userId && fcmToken) {
          await this.firestore().collection('users').doc(userId).update({
            fcmTokens: firestore.FieldValue.arrayRemove(fcmToken)
          });
        }
      } catch (tokenError) {
        console.error('Error clearing FCM token:', tokenError);
        // Continue sign out process even if token removal fails
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
      if (!email) {
        throw new Error('Email is required');
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
      if (!postId) {
        throw new Error('Post ID is required');
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
      if (!userId) {
        throw new Error('User ID is required');
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
      const allUserIds = [...connectedUserIds, userId];
      
      // Firestore 'in' operator supports up to 10 values
      if (allUserIds.length <= 10) {
        let query = this.firestore()
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
        let userPostsQuery = this.firestore()
          .collection('posts')
          .where('userId', '==', userId)
          .orderBy('timestamp', 'desc')
          .limit(limit / 2);
          
        if (lastDoc) {
          userPostsQuery = userPostsQuery.startAfter(lastDoc);
        }
        
        const userPostsSnapshot = await userPostsQuery.get();
        
        // Then get recent posts from all users
        let recentPostsQuery = this.firestore()
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
      if (!postId) {
        throw new Error('Post ID is required');
      }
      
      if (!userId) {
        throw new Error('User ID is required');
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
            try {
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

  // Additional methods remain the same but with improved input validation and error handling
  // ...
}

// Create singleton instance
const firebaseUtils = new FirebaseUtils();

export default firebaseUtils;
// src/utils/FirebaseUtils.js
// Utility functions for Firebase operations

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import SecurityUtils from './SecurityUtils';
import { sanitizeInput } from './validationUtils';
import { getAuthErrorMessage, getFirestoreErrorMessage, getStorageErrorMessage } from './errorUtils';

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
    this.currentUser = null;
    this.isConnected = true;
    this.offlineQueue = [];
    this.pendingUploads = [];

    // Initialize network listener
    this.initNetworkListener();

    // Initialize current user
    this.auth().onAuthStateChanged(user => {
      this.currentUser = user;
      
      // Sync offline operations when user is authenticated and online
      if (user && this.isConnected) {
        this.syncOfflineOperations();
      }
    });
  }

  /**
   * Initialize network connectivity listener
   */
  initNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected;
      
      if (!state.isConnected) {
        console.log('Network is disconnected. Firebase operations may be queued.');
      } else if (!wasConnected && state.isConnected) {
        // Connection has been restored, try to sync pending operations
        this.syncOfflineOperations();
      }
    });
  }

  /**
   * Synchronize offline operations when connection is restored
   */
  async syncOfflineOperations() {
    if (!this.isConnected || !this.currentUser) return;
    
    try {
      // Sync pending shares
      const pendingShares = JSON.parse(await AsyncStorage.getItem('pendingShares') || '[]');
      if (pendingShares.length > 0) {
        for (const share of pendingShares) {
          try {
            await this.firestore().collection('posts').doc(share.postId).update({
              shareCount: firestore.FieldValue.increment(1),
              lastUpdated: firestore.FieldValue.serverTimestamp()
            });
            
            await this.firestore().collection('postShares').add({
              ...share,
              timestamp: firestore.FieldValue.serverTimestamp()
            });
          } catch (error) {
            console.error('Error syncing pending share:', error);
          }
        }
        
        await AsyncStorage.setItem('pendingShares', JSON.stringify([]));
      }
      
      // Sync pending audit logs
      const pendingLogs = JSON.parse(await AsyncStorage.getItem('pendingAuditLogs') || '[]');
      if (pendingLogs.length > 0) {
        for (const log of pendingLogs) {
          try {
            await this.firestore().collection('auditLogs').add({
              ...log,
              timestamp: firestore.FieldValue.serverTimestamp(),
              syncedFromOffline: true
            });
          } catch (error) {
            console.error('Error syncing audit log:', error);
          }
        }
        
        await AsyncStorage.setItem('pendingAuditLogs', JSON.stringify([]));
      }
      
      // Process queued operations in order
      while (this.offlineQueue.length > 0 && this.isConnected) {
        const operation = this.offlineQueue.shift();
        try {
          await operation.execute();
        } catch (error) {
          console.error('Error executing queued operation:', error);
        }
      }
      
      // Sync pending uploads if any
      await this.processPendingUploads();
      
    } catch (error) {
      console.error('Error syncing offline operations:', error);
    }
  }

  /**
   * Process pending file uploads
   */
  async processPendingUploads() {
    try {
      const pendingUploads = JSON.parse(await AsyncStorage.getItem('pendingUploads') || '[]');
      
      if (pendingUploads.length === 0) return;
      
      for (const upload of pendingUploads) {
        try {
          // Check if the file still exists
          const fileExists = await RNFS.exists(upload.localUri.replace('file://', ''));
          
          if (!fileExists) {
            console.warn('Pending upload file no longer exists:', upload.localUri);
            continue;
          }
          
          // Upload the file
          const downloadUrl = await this.uploadToStorage(
            upload.localUri, 
            upload.storagePath, 
            upload.metadata
          );
          
          // Call the completion handler if provided
          if (upload.completionPath) {
            const [collection, docId, field] = upload.completionPath.split('/');
            
            if (collection && docId && field) {
              await this.firestore()
                .collection(collection)
                .doc(docId)
                .update({
                  [field]: downloadUrl,
                  [`${field}Uploaded`]: true,
                  lastUpdated: firestore.FieldValue.serverTimestamp()
                });
            }
          }
        } catch (error) {
          console.error('Error processing pending upload:', error);
        }
      }
      
      // Clear pending uploads
      await AsyncStorage.setItem('pendingUploads', JSON.stringify([]));
      
    } catch (error) {
      console.error('Error in processPendingUploads:', error);
    }
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
      
      // First check local cache for faster response
      const cachedData = await AsyncStorage.getItem(`user_${userId}`);
      let userData = null;
      
      if (cachedData) {
        try {
          userData = JSON.parse(cachedData);
          // If we have recent cached data, return it immediately
          const cacheTime = userData._cachedAt || 0;
          const cacheAge = Date.now() - cacheTime;
          
          // Use cache if less than 30 minutes old and not forcing refresh
          if (cacheAge < 30 * 60 * 1000) {
            return userData;
          }
        } catch (parseError) {
          console.error('Error parsing cached user data:', parseError);
        }
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        if (userData) {
          // Return cached data if available but mark it as potentially stale
          return {
            ...userData,
            _fromCache: true
          };
        }
        throw new Error('No internet connection. Please try again when online.');
      }
      
      // Fetch fresh data from Firestore
      const docRef = await this.firestore().collection('users').doc(userId).get();
      
      if (!docRef.exists) {
        throw new Error('User not found');
      }
      
      // Process the data
      const freshData = {
        id: docRef.id,
        ...docRef.data(),
        joinDate: docRef.data().joinDate?.toDate() || null,
        _cachedAt: Date.now()
      };
      
      // Update the cache
      await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(freshData));
      
      return freshData;
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
        // Queue operation for later execution
        this.offlineQueue.push({
          execute: async () => this.setUserData(userId, userData, merge),
          type: 'setUserData',
          data: { userId, userData, merge }
        });
        
        // Save in local storage for offline cache
        await AsyncStorage.setItem(`user_${userId}_pending`, JSON.stringify({
          userData,
          merge,
          timestamp: Date.now()
        }));
        
        throw new Error('No internet connection. Changes will be applied when you are back online.');
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
      
      // Update Firestore
      await this.firestore()
        .collection('users')
        .doc(userId)
        .set(sanitizedData, { merge });
        
      // Update local cache
      const cachedData = merge ? 
        { ...(JSON.parse(await AsyncStorage.getItem(`user_${userId}`) || '{}')), ...sanitizedData } : 
        sanitizedData;
        
      cachedData._cachedAt = Date.now();
      
      await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(cachedData));
      
      // Clear any pending changes
      await AsyncStorage.removeItem(`user_${userId}_pending`);
      
      return true;
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
        // Queue operation for later
        this.offlineQueue.push({
          execute: async () => this.updateUserProfile(userId, updates),
          type: 'updateUserProfile',
          data: { userId, updates }
        });
        
        // Store pending updates
        const pendingUpdates = JSON.parse(await AsyncStorage.getItem(`user_${userId}_pendingUpdates`) || '{}');
        const mergedUpdates = { ...pendingUpdates, ...updates, _pendingAt: Date.now() };
        await AsyncStorage.setItem(`user_${userId}_pendingUpdates`, JSON.stringify(mergedUpdates));
        
        // Update local cache optimistically
        try {
          const cachedData = JSON.parse(await AsyncStorage.getItem(`user_${userId}`) || '{}');
          const updatedCache = { ...cachedData, ...updates, _hasPendingUpdates: true };
          await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(updatedCache));
        } catch (cacheError) {
          console.error('Error updating local cache:', cacheError);
        }
        
        return true; // Return success for optimistic UI updates
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
      
      // Update Firestore
      await this.firestore()
        .collection('users')
        .doc(userId)
        .update(sanitizedUpdates);
        
      // Update local cache
      try {
        const cachedData = JSON.parse(await AsyncStorage.getItem(`user_${userId}`) || '{}');
        const updatedCache = { ...cachedData, ...sanitizedUpdates, _cachedAt: Date.now() };
        delete updatedCache._hasPendingUpdates;
        
        await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(updatedCache));
        await AsyncStorage.removeItem(`user_${userId}_pendingUpdates`);
      } catch (cacheError) {
        console.error('Error updating cache after profile update:', cacheError);
      }
      
      return true;
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
      
      const result = await this.auth().signInWithEmailAndPassword(email, password);
      
      // Create audit log
      try {
        await SecurityUtils.createAuditLog(
          result.user.uid,
          'sign_in',
          { platform: Platform.OS }
        );
      } catch (auditError) {
        console.error('Error creating sign-in audit log:', auditError);
        // Non-critical, continue
      }
      
      return result;
    } catch (error) {
      console.error('Sign in error:', error);
      
      // Get user-friendly error message
      const errorMessage = getAuthErrorMessage(error, 'login');
      throw new Error(errorMessage);
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
      
      // Get user-friendly error message
      const errorMessage = getAuthErrorMessage(error, 'registration');
      throw new Error(errorMessage);
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
      
      // Clear sensitive cached data
      try {
        const userKeys = await AsyncStorage.getAllKeys();
        const keysToRemove = userKeys.filter(key => 
          key.startsWith('user_') || 
          key === 'fcmToken' ||
          key === 'authState'
        );
        
        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
        }
      } catch (clearError) {
        console.error('Error clearing cached data during sign out:', clearError);
      }
      
      return true;
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
      
      return true;
    } catch (error) {
      console.error('Reset password error:', error);
      
      // Get user-friendly error message
      const errorMessage = getAuthErrorMessage(error, 'reset');
      throw new Error(errorMessage);
    }
  }

  /**
   * Upload a file to Firebase Storage
   * 
   * @param {string} uri - Local file URI
   * @param {string} path - Storage path
   * @param {Object} metadata - Optional metadata
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} Download URL
   */
  async uploadToStorage(uri, path, metadata = {}, onProgress = null) {
    try {
      if (!uri) {
        throw new Error('File URI is required');
      }
      
      if (!path) {
        throw new Error('Storage path is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        // Queue for later upload
        const pendingUploads = JSON.parse(await AsyncStorage.getItem('pendingUploads') || '[]');
        
        const uploadInfo = {
          localUri: uri,
          storagePath: path,
          metadata,
          timestamp: Date.now()
        };
        
        pendingUploads.push(uploadInfo);
        await AsyncStorage.setItem('pendingUploads', JSON.stringify(pendingUploads));
        
        throw new Error('No internet connection. File will be uploaded when online.');
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
      console.error('Upload to storage error:', error);
      const errorMessage = getStorageErrorMessage(error, 'upload');
      throw new Error(errorMessage);
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
    const imageMetadata = { 
      contentType: metadata.contentType || 'image/jpeg',
      ...metadata
    };
    
    return this.uploadToStorage(uri, path, imageMetadata, onProgress);
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
    try {
      if (!uri) {
        throw new Error('Image URI is required');
      }
      
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      const extension = uri.split('.').pop().toLowerCase() || 'jpg';
      const path = `profiles/${userId}_${Date.now()}.${extension}`;
      
      const url = await this.uploadImage(
        uri, 
        path, 
        { contentType: `image/${extension}` }, 
        onProgress
      );
      
      // Update user profile with new image URL
      if (url) {
        try {
          await this.updateUserProfile(userId, {
            profileImageURL: url,
            profileImagePath: path
          });
        } catch (updateError) {
          console.error('Error updating profile with new image:', updateError);
          // Continue - the image was uploaded successfully
        }
      }
      
      return url;
    } catch (error) {
      console.error('Upload profile image error:', error);
      throw error;
    }
  }
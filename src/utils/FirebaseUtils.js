// src/utils/FirebaseUtils.js
// Utility functions for Firebase operations

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import RNFS from 'react-native-fs';
import { sanitizeInput } from './validationUtils';
import { getAuthErrorMessage, getFirestoreErrorMessage, getStorageErrorMessage, withErrorHandling } from './errorUtils';

// Import the SecurityUtils class
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
    this.currentUser = null;
    this.isConnected = true;
    this.offlineQueue = [];
    this.pendingUploads = [];
    this.securityUtils = new SecurityUtils();

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
        const batch = this.firestore().batch();
        let batchCount = 0;
        const maxBatchSize = 500; // Firestore batch limit
        
        for (const log of pendingLogs) {
          try {
            const newLogRef = this.firestore().collection('auditLogs').doc();
            batch.set(newLogRef, {
              ...log,
              timestamp: firestore.FieldValue.serverTimestamp(),
              syncedFromOffline: true
            });
            
            batchCount++;
            
            // Commit batch when it reaches max size
            if (batchCount >= maxBatchSize) {
              await batch.commit();
              batchCount = 0;
            }
          } catch (error) {
            console.error('Error preparing audit log batch:', error);
          }
        }
        
        // Commit remaining batch operations
        if (batchCount > 0) {
          await batch.commit();
        }
        
        await AsyncStorage.setItem('pendingAuditLogs', JSON.stringify([]));
      }
      
      // Process queued operations in order
      const queueLength = this.offlineQueue.length;
      let processedCount = 0;
      const maxRetries = 3;
      
      while (this.offlineQueue.length > 0 && this.isConnected) {
        const operation = this.offlineQueue.shift();
        let success = false;
        let retries = 0;
        
        while (!success && retries < maxRetries) {
          try {
            await operation.execute();
            success = true;
          } catch (error) {
            retries++;
            console.error(`Error executing queued operation (retry ${retries}/${maxRetries}):`, error);
            
            if (retries >= maxRetries) {
              // Log failed operation for debugging
              console.error('Operation failed after max retries:', operation);
            } else {
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
          }
        }
        
        processedCount++;
        
        // Yield to event loop occasionally to prevent UI blocking
        if (processedCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
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
      
      // Clear processed uploads
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
   * @param {boolean} forceRefresh - Whether to bypass cache
   * @returns {Promise<Object>} User data
   */
  async getUserData(userId, forceRefresh = false) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // First check local cache for faster response (if not forcing refresh)
      if (!forceRefresh) {
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
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        const cachedData = await AsyncStorage.getItem(`user_${userId}`);
        if (cachedData) {
          // Return cached data if available but mark it as potentially stale
          try {
            const userData = JSON.parse(cachedData);
            return {
              ...userData,
              _fromCache: true
            };
          } catch (parseError) {
            console.error('Error parsing cached user data:', parseError);
          }
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
        // Convert Firestore timestamps to JS Dates
        joinDate: docRef.data().joinDate?.toDate() || null,
        lastUpdated: docRef.data().lastUpdated?.toDate() || null,
        lastActive: docRef.data().lastActive?.toDate() || null,
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
   * @returns {Promise<boolean>} Success status
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
          data: { userId, userData, merge },
          timestamp: Date.now()
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
      try {
        let cachedData;
        if (merge) {
          const existingData = await AsyncStorage.getItem(`user_${userId}`);
          cachedData = existingData ? { ...JSON.parse(existingData), ...sanitizedData } : sanitizedData;
        } else {
          cachedData = sanitizedData;
        }
        
        cachedData._cachedAt = Date.now();
        
        await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(cachedData));
        
        // Clear any pending changes
        await AsyncStorage.removeItem(`user_${userId}_pending`);
      } catch (cacheError) {
        console.error('Error updating user cache:', cacheError);
        // Non-critical error, continue
      }
      
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
   * @returns {Promise<boolean>} Success status
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
          data: { userId, updates },
          timestamp: Date.now()
        });
        
        // Store pending updates
        try {
          const pendingUpdates = JSON.parse(await AsyncStorage.getItem(`user_${userId}_pendingUpdates`) || '{}');
          const mergedUpdates = { ...pendingUpdates, ...updates, _pendingAt: Date.now() };
          await AsyncStorage.setItem(`user_${userId}_pendingUpdates`, JSON.stringify(mergedUpdates));
          
          // Update local cache optimistically
          const cachedData = JSON.parse(await AsyncStorage.getItem(`user_${userId}`) || '{}');
          const updatedCache = { ...cachedData, ...updates, _hasPendingUpdates: true };
          await AsyncStorage.setItem(`user_${userId}`, JSON.stringify(updatedCache));
        } catch (storageError) {
          console.error('Error storing pending updates:', storageError);
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
        // Non-critical error, continue
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
        await this.securityUtils.createAuditLog(
          result.user.uid,
          'sign_in',
          { platform: Platform.OS }
        );
      } catch (auditError) {
        console.error('Error creating sign-in audit log:', auditError);
        // Non-critical, continue
      }
      
      // Update user's last login time
      try {
        await this.updateUserProfile(result.user.uid, {
          lastLoginAt: firestore.FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        console.error('Error updating last login time:', updateError);
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
      if (this.securityUtils.isDisposableEmail(email)) {
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
          emailVerified: userCredential.user.emailVerified || false,
          medicalConditions: profileData.medicalConditions || [],
          role: 'user',
          status: 'active',
          createdAt: firestore.FieldValue.serverTimestamp(),
          lastLoginAt: firestore.FieldValue.serverTimestamp()
        }, false);
      } catch (profileError) {
        console.error('Error creating user profile:', profileError);
        
        // If profile creation fails but account was created,
        // we'll try to at least set minimal data
        try {
          await this.setUserData(userCredential.user.uid, {
            email,
            isNewUser: true,
            emailVerified: false,
            role: 'user',
            status: 'active'
          }, false);
        } catch (fallbackError) {
          console.error('Error creating minimal user profile:', fallbackError);
          // Continue with user creation even if profile creation fails
        }
      }
      
      // Create audit log
      try {
        await this.securityUtils.createAuditLog(
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
   * @returns {Promise<boolean>} Success status
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
      
      // Update last active timestamp if online
      if (isConnected && userId) {
        try {
          await this.firestore().collection('users').doc(userId).update({
            lastActive: firestore.FieldValue.serverTimestamp()
          });
        } catch (updateError) {
          console.error('Error updating last active timestamp:', updateError);
          // Continue signing out
        }
      }
      
      // Sign out
      await this.auth().signOut();
      
      // Create audit log if online
      if (isConnected && userId) {
        try {
          await this.securityUtils.createAuditLog(
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
   * @returns {Promise<boolean>} Success status
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
      
      // Log password reset attempt for security monitoring
      try {
        // Note: we don't have a user ID here, so we'll use email
        await firestore().collection('securityEvents').add({
          event: 'password_reset_requested',
          email: email,
          timestamp: firestore.FieldValue.serverTimestamp(),
          platform: Platform.OS,
          ipAddress: 'client-side' // Real IP should be captured server-side
        });
      } catch (logError) {
        console.error('Error logging password reset attempt:', logError);
        // Non-critical, continue
      }
      
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
        try {
          const pendingUploads = JSON.parse(await AsyncStorage.getItem('pendingUploads') || '[]');
          
          const uploadInfo = {
            localUri: uri,
            storagePath: path,
            metadata,
            timestamp: Date.now()
          };
          
          pendingUploads.push(uploadInfo);
          await AsyncStorage.setItem('pendingUploads', JSON.stringify(pendingUploads));
        } catch (storageError) {
          console.error('Error storing pending upload:', storageError);
        }
        
        throw new Error('No internet connection. File will be uploaded when online.');
      }
      
      // Ensure URI is properly formatted
      let filePath = uri;
      if (Platform.OS === 'ios' && !uri.startsWith('file://')) {
        filePath = `file://${uri}`;
      } else if (Platform.OS === 'android' && uri.startsWith('file://')) {
        filePath = uri.substring(7);
      }
      
      // Check if file exists
      try {
        const exists = await RNFS.exists(
          Platform.OS === 'ios' ? filePath.replace('file://', '') : filePath
        );
        
        if (!exists) {
          throw new Error('File does not exist');
        }
      } catch (fileCheckError) {
        console.error('Error checking file existence:', fileCheckError);
        throw new Error('Unable to access the file. Please try again.');
      }
      
      const reference = this.storage().ref(path);
      
      // Create upload task
      const task = reference.putFile(filePath, metadata);
      
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
    // Determine image mime type from URI or extension
    let contentType = metadata.contentType || 'image/jpeg';
    
    if (uri) {
      const extension = uri.split('.').pop().toLowerCase();
      if (extension === 'png') {
        contentType = 'image/png';
      } else if (extension === 'gif') {
        contentType = 'image/gif';
      } else if (extension === 'webp') {
        contentType = 'image/webp';
      } else if (extension === 'heic' || extension === 'heif') {
        contentType = 'image/heic';
      }
    }
    
    const imageMetadata = { 
      contentType,
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
      
      // Get content type based on extension
      let contentType = 'image/jpeg';
      if (extension === 'png') {
        contentType = 'image/png';
      } else if (extension === 'gif') {
        contentType = 'image/gif';
      } else if (extension === 'webp') {
        contentType = 'image/webp';
      } else if (extension === 'heic' || extension === 'heif') {
        contentType = 'image/heic';
      }
      
      const url = await this.uploadImage(
        uri, 
        path, 
        { contentType }, 
        onProgress
      );
      
      // Update user profile with new image URL
      if (url) {
        try {
          // Get current profile data
          const userDoc = await this.firestore().collection('users').doc(userId).get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            const oldImagePath = userData.profileImagePath;
            
            // Update profile with new image URL
            await this.updateUserProfile(userId, {
              profileImageURL: url,
              profileImagePath: path
            });
            
            // Attempt to delete old profile image if it exists
            if (oldImagePath) {
              try {
                const oldImageRef = this.storage().ref(oldImagePath);
                await oldImageRef.delete();
              } catch (deleteError) {
                console.error('Error deleting old profile image:', deleteError);
                // Non-critical, continue
              }
            }
          } else {
            // If user document doesn't exist, just update with the image
            await this.updateUserProfile(userId, {
              profileImageURL: url,
              profileImagePath: path
            });
          }
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
  
  /**
   * Upload a video to Firebase Storage
   * 
   * @param {string} uri - Local video URI
   * @param {string} thumbnailUri - Thumbnail URI for video
   * @param {string} path - Storage path
   * @param {Object} metadata - Optional metadata
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Object with download URL and thumbnail URL
   */
  async uploadVideo(uri, thumbnailUri, path, metadata = {}, onProgress = null) {
    try {
      if (!uri) {
        throw new Error('Video URI is required');
      }
      
      if (!path) {
        throw new Error('Storage path is required');
      }
      
      // Upload video file
      const videoUrl = await this.uploadToStorage(
        uri,
        path,
        { contentType: 'video/mp4', ...metadata },
        onProgress
      );
      
      let thumbnailUrl = null;
      
      // Upload thumbnail if provided
      if (thumbnailUri) {
        try {
          const thumbPath = `${path.split('.')[0]}_thumb.jpg`;
          thumbnailUrl = await this.uploadImage(
            thumbnailUri,
            thumbPath,
            { contentType: 'image/jpeg' }
          );
        } catch (thumbError) {
          console.error('Error uploading video thumbnail:', thumbError);
          // Continue without thumbnail
        }
      }
      
      return {
        videoUrl,
        thumbnailUrl
      };
    } catch (error) {
      console.error('Upload video error:', error);
      const errorMessage = getStorageErrorMessage(error, 'upload');
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Delete a file from Firebase Storage
   * 
   * @param {string} path - Storage path of the file
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(path) {
    try {
      if (!path) {
        throw new Error('Storage path is required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        // Queue for later deletion
        this.offlineQueue.push({
          execute: async () => this.deleteFile(path),
          type: 'deleteFile',
          data: { path },
          timestamp: Date.now()
        });
        
        throw new Error('No internet connection. File will be deleted when online.');
      }
      
      const reference = this.storage().ref(path);
      await reference.delete();
      
      return true;
    } catch (error) {
      // If file doesn't exist, consider deletion successful
      if (error.code === 'storage/object-not-found') {
        return true;
      }
      
      console.error('Delete file error:', error);
      const errorMessage = getStorageErrorMessage(error, 'delete');
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Create a new document in a collection
   * 
   * @param {string} collection - Collection name
   * @param {Object} data - Document data
   * @param {string} docId - Optional document ID
   * @returns {Promise<string>} Document ID
   */
  async createDocument(collection, data, docId = null) {
    try {
      if (!collection) {
        throw new Error('Collection name is required');
      }
      
      if (!data || typeof data !== 'object') {
        throw new Error('Document data must be an object');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        // Store for offline sync
        const offlineId = docId || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        this.offlineQueue.push({
          execute: async () => this.createDocument(collection, data, docId),
          type: 'createDocument',
          data: { collection, data, docId },
          timestamp: Date.now()
        });
        
        // Store in local storage for offline operation
        try {
          const pendingDocs = JSON.parse(await AsyncStorage.getItem(`pending_${collection}`) || '[]');
          pendingDocs.push({
            id: offlineId,
            data,
            timestamp: Date.now()
          });
          await AsyncStorage.setItem(`pending_${collection}`, JSON.stringify(pendingDocs));
        } catch (storageError) {
          console.error('Error storing pending document:', storageError);
        }
        
        return offlineId; // Return a temporary ID for optimistic UI updates
      }
      
      // Sanitize data
      const sanitizedData = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          sanitizedData[key] = sanitizeInput(value);
        } else {
          sanitizedData[key] = value;
        }
      }
      
      // Add timestamps
      sanitizedData.createdAt = firestore.FieldValue.serverTimestamp();
      sanitizedData.updatedAt = firestore.FieldValue.serverTimestamp();
      
      // Add the document to Firestore
      let docRef;
      if (docId) {
        docRef = this.firestore().collection(collection).doc(docId);
        await docRef.set(sanitizedData);
      } else {
        docRef = await this.firestore().collection(collection).add(sanitizedData);
      }
      
      return docRef.id;
    } catch (error) {
      console.error('Create document error:', error);
      const errorMessage = getFirestoreErrorMessage(error, collection);
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Update a document in a collection
   * 
   * @param {string} collection - Collection name
   * @param {string} docId - Document ID
   * @param {Object} data - Document data to update
   * @returns {Promise<boolean>} Success status
   */
  async updateDocument(collection, docId, data) {
    try {
      if (!collection || !docId) {
        throw new Error('Collection name and document ID are required');
      }
      
      if (!data || typeof data !== 'object') {
        throw new Error('Update data must be an object');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        this.offlineQueue.push({
          execute: async () => this.updateDocument(collection, docId, data),
          type: 'updateDocument',
          data: { collection, docId, data },
          timestamp: Date.now()
        });
        
        // Store in local storage for offline operation
        try {
          const pendingUpdates = JSON.parse(
            await AsyncStorage.getItem(`pending_updates_${collection}`) || '{}'
          );
          
          pendingUpdates[docId] = {
            ...pendingUpdates[docId],
            ...data,
            timestamp: Date.now()
          };
          
          await AsyncStorage.setItem(`pending_updates_${collection}`, JSON.stringify(pendingUpdates));
        } catch (storageError) {
          console.error('Error storing pending update:', storageError);
        }
        
        return true; // Optimistic update
      }
      
      // Sanitize data
      const sanitizedData = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          sanitizedData[key] = sanitizeInput(value);
        } else {
          sanitizedData[key] = value;
        }
      }
      
      // Add timestamp
      sanitizedData.updatedAt = firestore.FieldValue.serverTimestamp();
      
      // Update the document
      await this.firestore().collection(collection).doc(docId).update(sanitizedData);
      
      return true;
    } catch (error) {
      console.error('Update document error:', error);
      const errorMessage = getFirestoreErrorMessage(error, collection);
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Get a document from a collection
   * 
   * @param {string} collection - Collection name
   * @param {string} docId - Document ID
   * @returns {Promise<Object>} Document data
   */
  async getDocument(collection, docId) {
    try {
      if (!collection || !docId) {
        throw new Error('Collection name and document ID are required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        // Check local cache
        try {
          const cachedDoc = await AsyncStorage.getItem(`${collection}_${docId}`);
          if (cachedDoc) {
            return {
              ...JSON.parse(cachedDoc),
              _fromCache: true
            };
          }
        } catch (cacheError) {
          console.error('Error reading cached document:', cacheError);
        }
        
        throw new Error('No internet connection and no cached version available.');
      }
      
      const docRef = await this.firestore().collection(collection).doc(docId).get();
      
      if (!docRef.exists) {
        throw new Error('Document not found');
      }
      
      const docData = {
        id: docRef.id,
        ...docRef.data()
      };
      
      // Convert Firestore timestamps to JS Dates
      for (const [key, value] of Object.entries(docData)) {
        if (value && typeof value.toDate === 'function') {
          docData[key] = value.toDate();
        }
      }
      
      // Cache the document
      try {
        await AsyncStorage.setItem(`${collection}_${docId}`, JSON.stringify({
          ...docData,
          _cachedAt: Date.now()
        }));
      } catch (cacheError) {
        console.error('Error caching document:', cacheError);
        // Non-critical, continue
      }
      
      return docData;
    } catch (error) {
      console.error('Get document error:', error);
      throw error;
    }
  }
  
  /**
   * Delete a document from a collection
   * 
   * @param {string} collection - Collection name
   * @param {string} docId - Document ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteDocument(collection, docId) {
    try {
      if (!collection || !docId) {
        throw new Error('Collection name and document ID are required');
      }
      
      // Check network connectivity
      if (!(await this.checkConnection())) {
        this.offlineQueue.push({
          execute: async () => this.deleteDocument(collection, docId),
          type: 'deleteDocument',
          data: { collection, docId },
          timestamp: Date.now()
        });
        
        // Mark as pending deletion in local storage
        try {
          const pendingDeletions = JSON.parse(
            await AsyncStorage.getItem(`pending_deletions_${collection}`) || '[]'
          );
          
          pendingDeletions.push({
            id: docId,
            timestamp: Date.now()
          });
          
          await AsyncStorage.setItem(`pending_deletions_${collection}`, JSON.stringify(pendingDeletions));
          
          // Remove from cache
          await AsyncStorage.removeItem(`${collection}_${docId}`);
        } catch (storageError) {
          console.error('Error storing pending deletion:', storageError);
        }
        
        return true; // Optimistic delete
      }
      
      // Delete from Firestore
      await this.firestore().collection(collection).doc(docId).delete();
      
      // Remove from cache
      await AsyncStorage.removeItem(`${collection}_${docId}`);
      
      return true;
    } catch (error) {
      console.error('Delete document error:', error);
      const errorMessage = getFirestoreErrorMessage(error, collection);
      throw new Error(errorMessage);
    }
  }

  /**
   * Clean up resources and listeners when no longer needed
   */
  cleanup() {
    // Any cleanup that might be needed
    // This method helps prevent memory leaks
  }
}

// Export a singleton instance
const firebaseUtils = new FirebaseUtils();
export default firebaseUtils;
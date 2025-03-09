// src/utils/FirebaseUtils.js
// Improved utility functions for Firebase operations

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import RNFS from 'react-native-fs';
import { sanitizeInput } from './validationUtils';
import { getAuthErrorMessage, getFirestoreErrorMessage, getStorageErrorMessage, withErrorHandling } from './errorUtils';
import uuid from 'react-native-uuid';

// Import the SecurityUtils class
import SecurityUtils from './SecurityUtils';

// Offline operation status constants
const OPERATION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Maximum number of retries for operations
const MAX_RETRIES = 5;

/**
 * Enhanced Firebase utilities for authentication, data operations,
 * storage, and messaging with improved offline support and conflict resolution
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
    this.securityUtils = SecurityUtils;
    this.isSyncing = false;
    this.syncInterval = null;
    this.netInfoUnsubscribe = null;
    this.appStateSubscription = null;

    // Initialize network listener
    this.initNetworkListener();
    
    // Initialize app state listener to detect background/foreground transitions
    this.initAppStateListener();

    // Initialize current user
    this.auth().onAuthStateChanged(user => {
      this.currentUser = user;
      
      // Sync offline operations when user is authenticated and online
      if (user && this.isConnected) {
        this.syncOfflineOperations();
      }
    });
    
    // Set up periodic sync attempts for queued operations
    this.setupPeriodicSync();
  }

  /**
   * Initialize network connectivity listener with improved handling
   */
  initNetworkListener() {
    // Clean up existing listener if any
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }
    
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected && state.isInternetReachable !== false;
      
      if (!this.isConnected) {
        console.log('Network is disconnected. Firebase operations will be queued.');
        // Clear any ongoing sync when disconnected
        this.isSyncing = false;
      } else if (!wasConnected && this.isConnected) {
        console.log('Network connection restored. Syncing pending operations...');
        // Give a small delay before syncing to ensure connection is stable
        setTimeout(() => {
          this.syncOfflineOperations();
        }, 2000);
      }
    });
  }
  
  /**
   * Initialize app state listener to sync when app returns to foreground
   */
  initAppStateListener() {
    // Clean up existing listener if any
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    
    this.appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && this.isConnected && this.currentUser) {
        // App has come to the foreground
        this.syncOfflineOperations();
      }
    });
  }
  
  /**
   * Set up periodic sync attempts for resilience
   */
  setupPeriodicSync() {
    // Clear existing interval if any
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Try to sync every 5 minutes if there are pending operations
    this.syncInterval = setInterval(async () => {
      try {
        if (this.isConnected && this.currentUser && !this.isSyncing) {
          const hasPendingOps = 
            this.offlineQueue.length > 0 || 
            await this.hasPendingOperations();
          
          if (hasPendingOps) {
            this.syncOfflineOperations();
          }
        }
      } catch (error) {
        console.error('Error in periodic sync check:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Check if there are any pending operations in storage
   * @returns {Promise<boolean>} Whether there are pending operations
   */
  async hasPendingOperations() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      
      // Look for keys that indicate pending operations
      return keys.some(key => 
        key.startsWith('pending_') || 
        key.includes('_pending') ||
        key.includes('_pendingUpdates') ||
        key.includes('pendingUploads') ||
        key.includes('pendingShares') ||
        key.includes('pendingAuditLogs') ||
        key.includes('offlineQueue') ||
        key.includes('pendingDeletions')
      );
    } catch (error) {
      console.error('Error checking for pending operations:', error);
      return false;
    }
  }

  /**
   * Synchronize offline operations when connection is restored
   * Improved with transaction safety, conflict resolution, and chunked processing
   */
  async syncOfflineOperations() {
    if (!this.isConnected || !this.currentUser || this.isSyncing) return;
    
    try {
      this.isSyncing = true;
      console.log('Starting offline operation sync...');
      
      // Load persisted queue first
      await this.loadOfflineQueue();
      
      // Sync pending shares
      await this.syncPendingShares();
      
      // Let security utils sync its pending logs
      await this.securityUtils.syncPendingAuditLogs();
      
      // Process any pending uploads first
      await this.processPendingUploads();
      
      // Process queued operations in order with conflict resolution
      await this.processOfflineQueue();
      
      // Process any pending document changes
      await this.processPendingDocuments();
      
      console.log('Offline operation sync completed');
    } catch (error) {
      console.error('Error syncing offline operations:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Load offline queue from persistent storage
   */
  async loadOfflineQueue() {
    try {
      const queueData = await AsyncStorage.getItem('offlineQueue');
      if (queueData) {
        const savedQueue = JSON.parse(queueData);
        
        // Filter out any invalid operations and merge with current queue
        const validOperations = savedQueue.filter(op => 
          op && op.type && op.data && op.timestamp
        );
        
        // Merge with in-memory queue, avoiding duplicates
        const existingOpIds = new Set(this.offlineQueue.map(op => op.id));
        const newOps = validOperations.filter(op => !existingOpIds.has(op.id));
        
        this.offlineQueue = [...this.offlineQueue, ...newOps];
        
        console.log(`Loaded ${newOps.length} operations from persistent storage`);
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
    }
  }

  /**
   * Save offline queue to persistent storage
   */
  async saveOfflineQueue() {
    try {
      if (this.offlineQueue.length > 0) {
        await AsyncStorage.setItem('offlineQueue', JSON.stringify(this.offlineQueue));
      } else {
        await AsyncStorage.removeItem('offlineQueue');
      }
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  /**
   * Process operations in the offline queue
   * Improved with batching, error handling, and conflict resolution
   */
  async processOfflineQueue() {
    // Sort by timestamp to ensure operations are processed in order
    this.offlineQueue.sort((a, b) => a.timestamp - b.timestamp);
    
    const queueLength = this.offlineQueue.length;
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    console.log(`Processing ${queueLength} queued operations...`);
    
    // Process in chunks to avoid blocking UI
    const chunkSize = 10;
    
    while (this.offlineQueue.length > 0 && this.isConnected) {
      // Process a chunk of operations
      const chunk = this.offlineQueue.splice(0, chunkSize);
      
      // Create a promise for each operation with timeout
      const results = await Promise.allSettled(
        chunk.map(operation => {
          return Promise.race([
            this.processOperation(operation),
            new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error('Operation timed out'));
              }, 30000); // 30 second timeout
            })
          ]);
        })
      );
      
      // Handle results
      results.forEach((result, index) => {
        const operation = chunk[index];
        
        if (result.status === 'fulfilled' && result.value) {
          // Operation succeeded
          successCount++;
        } else {
          // Operation failed
          failedCount++;
          console.error(`Operation failed:`, operation, result.reason || 'Unknown error');
          
          // Retry operation if retries remaining
          if (!operation.retryCount || operation.retryCount < MAX_RETRIES) {
            // Exponential backoff
            const retryCount = (operation.retryCount || 0) + 1;
            const backoffDelay = Math.min(60000, Math.pow(2, retryCount) * 1000); // Cap at 1 minute
            
            // Add back to queue with retry info and delay
            this.offlineQueue.push({
              ...operation,
              retryCount,
              timestamp: Date.now() + backoffDelay
            });
          }
        }
      });
      
      processedCount += chunk.length;
      
      // Yield to event loop occasionally to prevent UI blocking
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Save remaining queue to persistent storage
      await this.saveOfflineQueue();
    }
    
    console.log(`Processed ${processedCount} operations: ${successCount} succeeded, ${failedCount} failed`);
  }

  /**
   * Sync pending shares
   * Processes pending post shares that were created while offline
   */
  async syncPendingShares() {
    try {
      const pendingShares = JSON.parse(await AsyncStorage.getItem('pendingShares') || '[]');
      if (pendingShares.length === 0) return;
      
      console.log(`Processing ${pendingShares.length} pending shares...`);
      
      const batch = this.firestore().batch();
      let batchCount = 0;
      const maxBatchSize = 500; // Firestore batch limit
      const processedShares = [];
      
      for (const share of pendingShares) {
        try {
          // Verify post still exists
          const postRef = this.firestore().collection('posts').doc(share.postId);
          const postDoc = await postRef.get();
          
          if (postDoc.exists) {
            // Update share count on post
            batch.update(postRef, {
              shareCount: firestore.FieldValue.increment(1),
              lastUpdated: firestore.FieldValue.serverTimestamp()
            });
            
            // Create share record
            const shareRef = this.firestore().collection('postShares').doc();
            batch.set(shareRef, {
              postId: share.postId,
              userId: share.userId,
              sharedWith: share.sharedWith || 'external',
              platform: share.platform || 'other',
              timestamp: share.timestamp 
                ? firestore.Timestamp.fromMillis(share.timestamp) 
                : firestore.FieldValue.serverTimestamp()
            });
            
            batchCount += 2; // Counting both operations
            processedShares.push(share);
            
            // Commit batch when it reaches max size
            if (batchCount >= maxBatchSize) {
              await batch.commit();
              batch = this.firestore().batch();
              batchCount = 0;
            }
          } else {
            // Post doesn't exist anymore, skip this share
            processedShares.push(share);
          }
        } catch (error) {
          console.error('Error processing pending share:', error);
        }
      }
      
      // Commit remaining batch operations
      if (batchCount > 0) {
        await batch.commit();
      }
      
      // Remove processed shares from pending list
      const remainingShares = pendingShares.filter(share => 
        !processedShares.some(processed => 
          processed.postId === share.postId && 
          processed.timestamp === share.timestamp
        )
      );
      
      await AsyncStorage.setItem('pendingShares', JSON.stringify(remainingShares));
      console.log(`Processed ${processedShares.length} pending shares`);
    } catch (error) {
      console.error('Error syncing pending shares:', error);
    }
  }
  
  /**
   * Process pending document operations
   * Handles creates, updates, and deletions that were stored while offline
   */
  async processPendingDocuments() {
    try {
      // Get all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Process pending document creations for each collection
      const pendingCreationKeys = allKeys.filter(key => key.startsWith('pending_') && !key.includes('Deletions') && !key.includes('Updates'));
      
      for (const key of pendingCreationKeys) {
        const collection = key.replace('pending_', '');
        await this.processPendingCreations(collection);
      }
      
      // Process pending document updates for each collection
      const pendingUpdateKeys = allKeys.filter(key => key.includes('_pendingUpdates'));
      
      for (const key of pendingUpdateKeys) {
        const collection = key.replace('pending_updates_', '');
        await this.processPendingUpdates(collection);
      }
      
      // Process pending document deletions for each collection
      const pendingDeletionKeys = allKeys.filter(key => key.includes('_pendingDeletions'));
      
      for (const key of pendingDeletionKeys) {
        const collection = key.replace('pending_deletions_', '');
        await this.processPendingDeletions(collection);
      }
    } catch (error) {
      console.error('Error processing pending documents:', error);
    }
  }
  
  /**
   * Process pending document creations for a collection
   * @param {string} collection - Collection name
   */
  async processPendingCreations(collection) {
    try {
      const pendingDocs = JSON.parse(await AsyncStorage.getItem(`pending_${collection}`) || '[]');
      if (pendingDocs.length === 0) return;
      
      console.log(`Processing ${pendingDocs.length} pending ${collection} creations...`);
      
      const processedDocs = [];
      const offlineIdMap = new Map(); // Maps offline IDs to server IDs
      
      for (const pendingDoc of pendingDocs) {
        try {
          // Skip invalid entries
          if (!pendingDoc || !pendingDoc.data) {
            processedDocs.push(pendingDoc);
            continue;
          }
          
          const docData = { ...pendingDoc.data };
          
          // Add timestamps if not present
          if (!docData.createdAt) {
            docData.createdAt = pendingDoc.timestamp 
              ? firestore.Timestamp.fromMillis(pendingDoc.timestamp)
              : firestore.FieldValue.serverTimestamp();
          }
          
          docData.updatedAt = firestore.FieldValue.serverTimestamp();
          docData.syncedFromOffline = true;
          
          // Create the document
          let docRef;
          if (pendingDoc.id && !pendingDoc.id.startsWith('offline_')) {
            docRef = this.firestore().collection(collection).doc(pendingDoc.id);
            await docRef.set(docData);
          } else {
            docRef = await this.firestore().collection(collection).add(docData);
            
            // Store mapping from offline ID to real ID
            if (pendingDoc.id && pendingDoc.id.startsWith('offline_')) {
              offlineIdMap.set(pendingDoc.id, docRef.id);
            }
          }
          
          processedDocs.push(pendingDoc);
        } catch (error) {
          console.error(`Error creating ${collection} document:`, error);
          // Keep failed docs in the pending list
        }
      }
      
      // Remove processed docs from pending list
      const remainingDocs = pendingDocs.filter(doc => 
        !processedDocs.some(processed => processed.id === doc.id)
      );
      
      await AsyncStorage.setItem(`pending_${collection}`, JSON.stringify(remainingDocs));
      
      // Store offline ID mapping for conflict resolution
      if (offlineIdMap.size > 0) {
        try {
          const existingMap = JSON.parse(await AsyncStorage.getItem('offlineIdMap') || '{}');
          const updatedMap = { ...existingMap };
          
          offlineIdMap.forEach((serverId, offlineId) => {
            updatedMap[offlineId] = serverId;
          });
          
          await AsyncStorage.setItem('offlineIdMap', JSON.stringify(updatedMap));
        } catch (mapError) {
          console.error('Error storing offline ID map:', mapError);
        }
      }
      
      console.log(`Processed ${processedDocs.length} pending ${collection} creations`);
    } catch (error) {
      console.error(`Error processing pending ${collection} creations:`, error);
    }
  }
  
  /**
   * Process pending document updates for a collection
   * @param {string} collection - Collection name
   */
  async processPendingUpdates(collection) {
    try {
      const pendingUpdates = JSON.parse(await AsyncStorage.getItem(`pending_updates_${collection}`) || '{}');
      const docIds = Object.keys(pendingUpdates);
      
      if (docIds.length === 0) return;
      
      console.log(`Processing ${docIds.length} pending ${collection} updates...`);
      
      // Get offline ID mapping for conflict resolution
      const offlineIdMap = JSON.parse(await AsyncStorage.getItem('offlineIdMap') || '{}');
      const processedIds = [];
      
      for (const docId of docIds) {
        try {
          const updates = pendingUpdates[docId];
          if (!updates) continue;
          
          // If this is an offline ID, get the real server ID
          let realDocId = docId;
          if (docId.startsWith('offline_') && offlineIdMap[docId]) {
            realDocId = offlineIdMap[docId];
          }
          
          // Add timestamp and offline flag
          const docUpdates = {
            ...updates,
            updatedAt: firestore.FieldValue.serverTimestamp(),
            syncedFromOffline: true
          };
          
          delete docUpdates.timestamp;
          delete docUpdates._pendingAt;
          
          // Update the document
          const docRef = this.firestore().collection(collection).doc(realDocId);
          await docRef.update(docUpdates);
          
          processedIds.push(docId);
        } catch (error) {
          console.error(`Error updating ${collection} document:`, error);
          // Keep failed updates in the pending list
        }
      }
      
      // Remove processed updates from pending list
      const remainingUpdates = { ...pendingUpdates };
      processedIds.forEach(id => {
        delete remainingUpdates[id];
      });
      
      await AsyncStorage.setItem(`pending_updates_${collection}`, JSON.stringify(remainingUpdates));
      console.log(`Processed ${processedIds.length} pending ${collection} updates`);
    } catch (error) {
      console.error(`Error processing pending ${collection} updates:`, error);
    }
  }
  
  /**
   * Process pending document deletions for a collection
   * @param {string} collection - Collection name
   */
  async processPendingDeletions(collection) {
    try {
      const pendingDeletions = JSON.parse(await AsyncStorage.getItem(`pending_deletions_${collection}`) || '[]');
      
      if (pendingDeletions.length === 0) return;
      
      console.log(`Processing ${pendingDeletions.length} pending ${collection} deletions...`);
      
      // Get offline ID mapping for conflict resolution
      const offlineIdMap = JSON.parse(await AsyncStorage.getItem('offlineIdMap') || '{}');
      const processedIds = [];
      
      for (const deletion of pendingDeletions) {
        try {
          if (!deletion || !deletion.id) continue;
          
          // If this is an offline ID, get the real server ID or skip
          let realDocId = deletion.id;
          if (deletion.id.startsWith('offline_')) {
            if (offlineIdMap[deletion.id]) {
              realDocId = offlineIdMap[deletion.id];
            } else {
              // If no real ID exists, the document was never created on server
              processedIds.push(deletion);
              continue;
            }
          }
          
          // Delete the document
          await this.firestore().collection(collection).doc(realDocId).delete();
          
          processedIds.push(deletion);
        } catch (error) {
          // If document doesn't exist, consider deletion successful
          if (error.code === 'firestore/not-found') {
            processedIds.push(deletion);
          } else {
            console.error(`Error deleting ${collection} document:`, error);
            // Keep failed deletions in the pending list
          }
        }
      }
      
      // Remove processed deletions from pending list
      const remainingDeletions = pendingDeletions.filter(deletion => 
        !processedIds.some(processed => processed.id === deletion.id)
      );
      
      await AsyncStorage.setItem(`pending_deletions_${collection}`, JSON.stringify(remainingDeletions));
      console.log(`Processed ${processedIds.length} pending ${collection} deletions`);
    } catch (error) {
      console.error(`Error processing pending ${collection} deletions:`, error);
    }
  }

  /**
   * Process a single operation from the queue
   * @param {Object} operation - The operation to process
   * @returns {Promise<boolean>} Success status
   */
  async processOperation(operation) {
    try {
      if (!operation || !operation.type || !operation.data) {
        return false;
      }
      
      switch (operation.type) {
        case 'setUserData':
          await this.setUserData(
            operation.data.userId,
            operation.data.userData,
            operation.data.merge,
            true // skipQueue flag to prevent recursion
          );
          return true;
          
        case 'updateUserProfile':
          await this.updateUserProfile(
            operation.data.userId,
            operation.data.updates,
            true // skipQueue flag
          );
          return true;
          
        case 'createDocument':
          await this.createDocument(
            operation.data.collection,
            operation.data.data,
            operation.data.docId,
            true // skipQueue flag
          );
          return true;
          
        case 'updateDocument':
          await this.updateDocument(
            operation.data.collection,
            operation.data.docId,
            operation.data.data,
            true // skipQueue flag
          );
          return true;
          
        case 'deleteDocument':
          await this.deleteDocument(
            operation.data.collection,
            operation.data.docId,
            true // skipQueue flag
          );
          return true;
          
        case 'deleteFile':
          await this.deleteFile(
            operation.data.path,
            true // skipQueue flag
          );
          return true;
          
        default:
          console.warn(`Unknown operation type: ${operation.type}`);
          return false;
      }
    } catch (error) {
      console.error(`Error processing operation ${operation.type}:`, error);
      return false;
    }
// src/services/FirebaseService.js
// Centralized Firebase services for the application

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Platform } from 'react-native';
import { getMimeType } from '../utils/mediaProcessing';

/**
 * Authentication service for Firebase
 */
export const AuthService = {
  /**
   * Sign in with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<UserCredential>} Firebase auth user credential
   */
  signIn: async (email, password) => {
    return await auth().signInWithEmailAndPassword(email, password);
  },

  /**
   * Sign up with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<UserCredential>} Firebase auth user credential
   */
  signUp: async (email, password) => {
    return await auth().createUserWithEmailAndPassword(email, password);
  },

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  signOut: async () => {
    return await auth().signOut();
  },

  /**
   * Send password reset email
   * @param {string} email - User email
   * @returns {Promise<void>}
   */
  resetPassword: async (email) => {
    return await auth().sendPasswordResetEmail(email);
  },

  /**
   * Update user profile in auth and firestore
   * @param {FirebaseUser} user - Firebase auth user
   * @param {Object} profileData - User profile data
   * @returns {Promise<void>}
   */
  updateProfile: async (user, profileData) => {
    // First, update any firebase auth fields if present
    const authUpdates = {};
    
    if (profileData.email) {
      authUpdates.email = profileData.email;
    }
    
    if (profileData.displayName || (profileData.firstName && profileData.lastName)) {
      authUpdates.displayName = profileData.displayName || 
        `${profileData.firstName} ${profileData.lastName}`.trim();
    }
    
    if (profileData.photoURL || profileData.profileImageURL) {
      authUpdates.photoURL = profileData.photoURL || profileData.profileImageURL;
    }
    
    if (Object.keys(authUpdates).length > 0) {
      await user.updateProfile(authUpdates);
    }
    
    // Then update user document in Firestore
    if (user.uid) {
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set({
          ...profileData,
          id: user.uid,
          updatedAt: firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
  },

  /**
   * Delete user account
   * @returns {Promise<void>}
   */
  deleteAccount: async () => {
    const user = auth().currentUser;
    if (!user) throw new Error('No user is currently signed in');
    
    // Delete user's firestore document
    await firestore().collection('users').doc(user.uid).delete();
    
    // Delete user's auth account
    return await user.delete();
  }
};

/**
 * Post service for managing posts
 */
export const PostService = {
  /**
   * Create a new post
   * @param {Object} postData - Post data
   * @returns {Promise<string>} Post ID
   */
  createPost: async (postData) => {
    try {
      // Add timestamp and initialize counts
      const enhancedPostData = {
        ...postData,
        timestamp: firestore.FieldValue.serverTimestamp(),
        likeCount: 0,
        commentCount: 0,
        shareCount: 0
      };
      
      // Add to Firestore
      const docRef = await firestore().collection('posts').add(enhancedPostData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  },

  /**
   * Get posts for the feed
   * @param {string} userId - Current user ID
   * @param {Array<string>} blockedUsers - List of blocked user IDs
   * @param {number} limit - Number of posts to fetch
   * @param {FirestoreDocumentSnapshot} startAfter - Starting point for pagination
   * @returns {Promise<Object>} Object containing posts and pagination info
   */
  getFeedPosts: async (userId, blockedUsers = [], limit = 10, startAfter = null) => {
    try {
      // Get user's connections (people they follow)
      const connectionsSnapshot = await firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .get();

      // Extract connected user IDs and filter out blocked users
      let connectedUserIds = connectionsSnapshot.docs
        .map(doc => doc.data().connectedUserId)
        .filter(id => !blockedUsers.includes(id));

      // Add current user's ID to include their own posts
      const userIds = [...connectedUserIds, userId]
        .filter(id => !blockedUsers.includes(id));
      
      // If no connections and just the user, we'll still query but might get empty results
      let query = firestore()
        .collection('posts')
        .where('userId', 'in', userIds.length > 0 ? userIds.slice(0, Math.min(userIds.length, 10)) : ['NO_RESULTS'])
        .orderBy('timestamp', 'desc');
        
      if (startAfter) {
        query = query.startAfter(startAfter);
      }
      
      query = query.limit(limit);
      const snapshot = await query.get();
      
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      
      return {
        posts,
        lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
        hasMore: snapshot.docs.length === limit
      };
    } catch (error) {
      console.error('Error fetching feed posts:', error);
      throw error;
    }
  },
  
  /**
   * Get posts by a specific user
   * @param {string} userId - User ID
   * @param {number} limit - Number of posts to fetch
   * @param {FirestoreDocumentSnapshot} startAfter - Starting point for pagination
   * @returns {Promise<Object>} Object containing posts and pagination info
   */
  getUserPosts: async (userId, limit = 20, startAfter = null) => {
    try {
      let query = firestore()
        .collection('posts')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc');
        
      if (startAfter) {
        query = query.startAfter(startAfter);
      }
      
      query = query.limit(limit);
      const snapshot = await query.get();
      
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      
      return {
        posts,
        lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
        hasMore: snapshot.docs.length === limit
      };
    } catch (error) {
      console.error('Error fetching user posts:', error);
      throw error;
    }
  },
  
  /**
   * Delete a post
   * @param {string} postId - Post ID
   * @returns {Promise<void>}
   */
  deletePost: async (postId) => {
    try {
      // First, get the post to check if there are media files to delete
      const postDoc = await firestore().collection('posts').doc(postId).get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      const postData = postDoc.data();
      
      // Delete associated media from storage if present
      if (postData.content && postData.content.startsWith('https://')) {
        try {
          // Try to get a storage reference from the URL
          const storageRef = storage().refFromURL(postData.content);
          await storageRef.delete();
        } catch (storageError) {
          // Silently handle storage deletion errors
          console.warn('Could not delete media file:', storageError);
        }
      }
      
      // Delete comments associated with the post
      const commentsSnapshot = await firestore()
        .collection('comments')
        .where('postId', '==', postId)
        .get();
      
      const batch = firestore().batch();
      
      commentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Delete likes associated with the post
      const likesSnapshot = await firestore()
        .collection('likes')
        .where('postId', '==', postId)
        .get();
      
      likesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Delete the post document
      batch.delete(firestore().collection('posts').doc(postId));
      
      // Commit the batch
      await batch.commit();
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  },
  
  /**
   * Like or unlike a post
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @param {boolean} like - Whether to like or unlike
   * @returns {Promise<boolean>} Whether the operation changed the like status
   */
  toggleLike: async (postId, userId, like = true) => {
    try {
      // Find existing like document if any
      const likeQuery = await firestore()
        .collection('likes')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      // Use a transaction to ensure consistency
      return await firestore().runTransaction(async (transaction) => {
        // Get the current post
        const postRef = firestore().collection('posts').doc(postId);
        const postDoc = await transaction.get(postRef);
        
        if (!postDoc.exists) {
          throw new Error('Post not found');
        }
        
        // Current like count
        const currentLikeCount = postDoc.data().likeCount || 0;
        
        // Check if like already exists
        const likeExists = !likeQuery.empty;
        
        if (like && !likeExists) {
          // Add like and increment count
          const newLikeRef = firestore().collection('likes').doc();
          transaction.set(newLikeRef, {
            postId,
            userId,
            timestamp: firestore.FieldValue.serverTimestamp()
          });
          transaction.update(postRef, { likeCount: currentLikeCount + 1 });
          return true;
        } else if (!like && likeExists) {
          // Remove like and decrement count
          transaction.delete(likeQuery.docs[0].ref);
          transaction.update(postRef, { 
            likeCount: Math.max(0, currentLikeCount - 1) 
          });
          return true;
        }
        
        // No change needed
        return false;
      });
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  },
  
  /**
   * Check if a user has liked a post
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the user has liked the post
   */
  checkLikeStatus: async (postId, userId) => {
    try {
      const snapshot = await firestore()
        .collection('likes')
        .where('postId', '==', postId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking like status:', error);
      throw error;
    }
  }
};

/**
 * Upload service for managing file uploads
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
    try {
      const reference = storage().ref(storagePath);
      
      // Create upload task
      const task = reference.putFile(uri);
      
      // Monitor upload progress
      if (onProgress) {
        task.on('state_changed', snapshot => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        });
      }
      
      // Wait for upload to complete
      await task;
      
      // Get download URL
      return await reference.getDownloadURL();
    } catch (error) {
      console.error('Error uploading image:', error);
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
    try {
      const reference = storage().ref(storagePath);
      
      // Create upload task
      const task = reference.putFile(uri);
      
      // Monitor upload progress
      if (onProgress) {
        task.on('state_changed', snapshot => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        });
      }
      
      // Wait for upload to complete
      await task;
      
      // Get download URL
      return await reference.getDownloadURL();
    } catch (error) {
      console.error('Error uploading video:', error);
      throw error;
    }
  },
  
  /**
   * Upload any file to Firebase Storage
   * @param {string} uri - Local URI of the file
   * @param {string} storagePath - Path in Firebase Storage
   * @param {string} mimeType - MIME type of the file
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} Download URL
   */
  uploadFile: async (uri, storagePath, mimeType = null, onProgress = null) => {
    try {
      const reference = storage().ref(storagePath);
      
      // Fix for file:// URIs on Android
      const filePath = Platform.OS === 'android' && uri.startsWith('file://') 
        ? uri.substring(7) 
        : uri;
      
      // Detect MIME type if not provided
      const contentType = mimeType || getMimeType(uri);
      
      // Create metadata
      const metadata = {
        contentType,
      };
      
      // Create upload task
      const task = reference.putFile(filePath, metadata);
      
      // Monitor upload progress
      if (onProgress) {
        task.on('state_changed', snapshot => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        });
      }
      
      // Wait for upload to complete
      await task;
      
      // Get download URL
      return await reference.getDownloadURL();
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },
  
  /**
   * Delete a file from Firebase Storage
   * @param {string} url - File URL
   * @returns {Promise<void>}
   */
  deleteFile: async (url) => {
    try {
      if (!url || !url.startsWith('https://')) {
        return;
      }
      
      const reference = storage().refFromURL(url);
      await reference.delete();
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
};

/**
 * Block service for managing blocked users
 */
export const BlockService = {
  /**
   * Get details of blocked users
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of blocked user details
   */
  getBlockedUserDetails: async (userId) => {
    try {
      // Get blocked users IDs
      const blockedSnapshot = await firestore()
        .collection('blocks')
        .where('userId', '==', userId)
        .get();
      
      if (blockedSnapshot.empty) {
        return [];
      }
      
      // Extract blocked user IDs and block info
      const blockedUsers = blockedSnapshot.docs.map(doc => ({
        blockedUserId: doc.data().blockedUserId,
        reason: doc.data().reason,
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      
      // Batch fetch user details for blocked users
      const blockedUserIds = blockedUsers.map(item => item.blockedUserId);
      
      // Split into batches of 10 (Firestore limit for 'in' queries)
      const userDetailPromises = [];
      for (let i = 0; i < blockedUserIds.length; i += 10) {
        const batch = blockedUserIds.slice(i, i + 10);
        userDetailPromises.push(
          firestore()
            .collection('users')
            .where('id', 'in', batch)
            .get()
        );
      }
      
      const userDetailSnapshots = await Promise.all(userDetailPromises);
      
      // Create a map of user details
      const userDetailsMap = {};
      userDetailSnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          userDetailsMap[doc.id] = doc.data();
        });
      });
      
      // Combine block info with user details
      return blockedUsers.map(blockInfo => {
        const userDetails = userDetailsMap[blockInfo.blockedUserId] || {};
        return {
          id: blockInfo.blockedUserId,
          ...userDetails,
          blockInfo: {
            reason: blockInfo.reason,
            timestamp: blockInfo.timestamp
          }
        };
      });
    } catch (error) {
      console.error('Error getting blocked user details:', error);
      throw error;
    }
  },
  
  /**
   * Block a user
   * @param {string} userId - Current user ID
   * @param {string} blockedUserId - User ID to block
   * @param {string} reason - Reason for blocking
   * @returns {Promise<boolean>} Success status
   */
  blockUser: async (userId, blockedUserId, reason = '') => {
    try {
      // Check if already blocked
      const blockDoc = await firestore()
        .collection('blocks')
        .where('userId', '==', userId)
        .where('blockedUserId', '==', blockedUserId)
        .limit(1)
        .get();
      
      if (!blockDoc.empty) {
        // Already blocked
        return true;
      }
      
      // Add to blocks collection
      await firestore().collection('blocks').add({
        userId,
        blockedUserId,
        reason,
        timestamp: firestore.FieldValue.serverTimestamp()
      });
      
      // Remove any connections between the users
      const connectionsQuery = await firestore()
        .collection('connections')
        .where('userId', 'in', [userId, blockedUserId])
        .where('connectedUserId', 'in', [userId, blockedUserId])
        .get();
      
      // Use batch write for better performance
      if (!connectionsQuery.empty) {
        const batch = firestore().batch();
        connectionsQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
      
      return true;
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  },
  
  /**
   * Unblock a user
   * @param {string} userId - Current user ID
   * @param {string} blockedUserId - User ID to unblock
   * @returns {Promise<boolean>} Success status
   */
  unblockUser: async (userId, blockedUserId) => {
    try {
      const blockQuery = await firestore()
        .collection('blocks')
        .where('userId', '==', userId)
        .where('blockedUserId', '==', blockedUserId)
        .limit(1)
        .get();
      
      if (blockQuery.empty) {
        // Not blocked
        return true;
      }
      
      // Delete block document
      await blockQuery.docs[0].ref.delete();
      
      return true;
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  }
};

/**
 * Content moderation service
 */
export const ContentModerationService = {
  /**
   * Submit a report for content moderation
   * @param {Object} reportData - Report data
   * @returns {Promise<string>} Report ID
   */
  submitReport: async (reportData) => {
    try {
      const enhancedReportData = {
        ...reportData,
        timestamp: firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        reviewed: false
      };
      
      const docRef = await firestore().collection('reports').add(enhancedReportData);
      return docRef.id;
    } catch (error) {
      console.error('Error submitting report:', error);
      throw error;
    }
  },
  
  /**
   * Moderate reported content
   * @param {string} reportId - Report ID
   * @param {Object} decision - Moderation decision
   * @returns {Promise<boolean>} Success status
   */
  moderateContent: async (reportId, decision) => {
    try {
      // Get the report
      const reportRef = firestore().collection('reports').doc(reportId);
      const reportDoc = await reportRef.get();
      
      if (!reportDoc.exists) {
        throw new Error('Report not found');
      }
      
      const reportData = reportDoc.data();
      
      // Update the report with the decision
      await reportRef.update({
        status: decision.decision,
        moderatorId: decision.moderatorId,
        moderatorNotes: decision.notes,
        reason: decision.reason,
        reviewTimestamp: firestore.FieldValue.serverTimestamp(),
        reviewed: true
      });
      
      // Handle content removal if needed
      if (decision.decision === 'remove') {
        const { type, contentId } = reportData;
        
        if (type === 'post') {
          // Delete the post
          await PostService.deletePost(contentId);
        } else if (type === 'comment') {
          // Delete the comment
          await firestore().collection('comments').doc(contentId).delete();
          
          // Decrement comment count on the post
          if (reportData.postId) {
            await firestore().collection('posts').doc(reportData.postId).update({
              commentCount: firestore.FieldValue.increment(-1)
            });
          }
        } else if (type === 'user') {
          // For user reports, we don't delete the user, but we could add them to a restricted list
          await firestore().collection('restrictedUsers').add({
            userId: contentId,
            reason: decision.reason,
            timestamp: firestore.FieldValue.serverTimestamp(),
            moderatorId: decision.moderatorId
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error moderating content:', error);
      throw error;
    }
  }
};
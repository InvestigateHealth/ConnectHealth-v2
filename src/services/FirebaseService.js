// src/services/FirebaseService.js
// Centralized Firebase services for the app

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Alert } from 'react-native';

/**
 * Authentication Service
 */
export const AuthService = {
  /**
   * Sign in with email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<UserCredential>}
   */
  signIn: async (email, password) => {
    try {
      return await auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  },

  /**
   * Sign up with email and password
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<UserCredential>}
   */
  signUp: async (email, password) => {
    try {
      return await auth().createUserWithEmailAndPassword(email, password);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  },

  /**
   * Sign out current user
   */
  signOut: async () => {
    try {
      await auth().signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  /**
   * Reset password with email
   * @param {string} email 
   */
  resetPassword: async (email) => {
    try {
      await auth().sendPasswordResetEmail(email);
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  },

  /**
   * Update user profile
   * @param {FirebaseUser} user 
   * @param {Object} data 
   */
  updateProfile: async (user, data) => {
    try {
      // Update auth profile if display name or photo provided
      const authUpdates = {};
      if (data.firstName || data.lastName) {
        const displayName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
        authUpdates.displayName = displayName;
      }
      if (data.profileImageURL) {
        authUpdates.photoURL = data.profileImageURL;
      }

      if (Object.keys(authUpdates).length > 0) {
        await user.updateProfile(authUpdates);
      }

      // Create or update user document in Firestore
      await firestore().collection('users').doc(user.uid).set(
        {
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: user.email,
          id: user.uid,
          ...(data.profileImageURL && { profileImageURL: data.profileImageURL }),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  },

  /**
   * Delete user account
   */
  deleteAccount: async () => {
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('No user is currently signed in');

      // Delete user's Firestore document
      await firestore().collection('users').doc(user.uid).delete();

      // Delete user's auth account
      await user.delete();
    } catch (error) {
      console.error('Delete account error:', error);
      throw error;
    }
  }
};

/**
 * Upload Service
 */
export const UploadService = {
  /**
   * Upload an image to Firebase Storage
   * @param {string} uri - Local uri of the image
   * @param {string} path - Storage path to save the image
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} - Download URL
   */
  uploadImage: async (uri, path, onProgress = () => {}) => {
    try {
      const reference = storage().ref(path);
      const task = reference.putFile(uri);
      
      // Set up progress tracking
      task.on('state_changed', snapshot => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(progress);
      });
      
      // Wait for upload to complete
      await task;
      
      // Get and return download URL
      const url = await reference.getDownloadURL();
      return url;
    } catch (error) {
      console.error('Upload image error:', error);
      throw error;
    }
  },
  
  /**
   * Upload a video to Firebase Storage
   * @param {string} uri - Local uri of the video
   * @param {string} path - Storage path to save the video
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} - Download URL
   */
  uploadVideo: async (uri, path, onProgress = () => {}) => {
    try {
      const reference = storage().ref(path);
      const task = reference.putFile(uri);
      
      // Set up progress tracking
      task.on('state_changed', snapshot => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(progress);
      });
      
      // Wait for upload to complete
      await task;
      
      // Get and return download URL
      const url = await reference.getDownloadURL();
      return url;
    } catch (error) {
      console.error('Upload video error:', error);
      throw error;
    }
  },
  
  /**
   * Delete a file from Firebase Storage by URL
   * @param {string} url - Storage URL
   */
  deleteFile: async (url) => {
    try {
      if (!url) return;
      
      const reference = storage().refFromURL(url);
      await reference.delete();
    } catch (error) {
      console.error('Delete file error:', error);
      // Don't throw - deletion failures shouldn't stop app flow
      // Just log the error
    }
  }
};

/**
 * Post Service
 */
export const PostService = {
  /**
   * Create a new post
   * @param {object} postData - Post data
   * @returns {Promise<string>} - Post ID
   */
  createPost: async (postData) => {
    try {
      // Add timestamp and default values
      const data = {
        ...postData,
        timestamp: firestore.FieldValue.serverTimestamp(),
        likeCount: 0,
        commentCount: 0,
        likes: []
      };
      
      // Add to Firestore
      const docRef = await firestore().collection('posts').add(data);
      return docRef.id;
    } catch (error) {
      console.error('Create post error:', error);
      throw error;
    }
  },
  
  /**
   * Update a post
   * @param {string} postId - Post ID
   * @param {object} postData - Updated post data
   */
  updatePost: async (postId, postData) => {
    try {
      await firestore()
        .collection('posts')
        .doc(postId)
        .update({
          ...postData,
          updatedAt: firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('Update post error:', error);
      throw error;
    }
  },
  
  /**
   * Delete a post
   * @param {string} postId - Post ID
   */
  deletePost: async (postId) => {
    try {
      // Get post to check for media URLs
      const postDoc = await firestore().collection('posts').doc(postId).get();
      if (postDoc.exists) {
        const postData = postDoc.data();
        
        // Delete media from storage if it exists
        if (postData.content && (postData.type === 'image' || postData.type === 'video')) {
          await UploadService.deleteFile(postData.content).catch(err => console.error(err));
        }
        
        // Delete comments for this post
        const commentsSnapshot = await firestore()
          .collection('comments')
          .where('postId', '==', postId)
          .get();
        
        const batch = firestore().batch();
        commentsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        // Delete the post document
        batch.delete(firestore().collection('posts').doc(postId));
        
        // Commit all deletions
        await batch.commit();
      }
    } catch (error) {
      console.error('Delete post error:', error);
      throw error;
    }
  },
  
  /**
   * Toggle like on a post
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - New like state
   */
  toggleLike: async (postId, userId) => {
    try {
      // Get post data
      const postRef = firestore().collection('posts').doc(postId);
      const postDoc = await postRef.get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      const postData = postDoc.data();
      const likes = postData.likes || [];
      const isLiked = likes.includes(userId);
      
      // Toggle like
      if (isLiked) {
        // Unlike
        await postRef.update({
          likes: firestore.FieldValue.arrayRemove(userId),
          likeCount: firestore.FieldValue.increment(-1)
        });
        
        // Remove notification if it exists
        await firestore()
          .collection('notifications')
          .where('type', '==', 'like')
          .where('postId', '==', postId)
          .where('senderId', '==', userId)
          .get()
          .then(snapshot => {
            snapshot.forEach(doc => {
              doc.ref.delete();
            });
          });
        
        return false;
      } else {
        // Like
        await postRef.update({
          likes: firestore.FieldValue.arrayUnion(userId),
          likeCount: firestore.FieldValue.increment(1)
        });
        
        // Create notification if user is not the post author
        if (userId !== postData.userId) {
          const currentUser = await firestore().collection('users').doc(userId).get();
          const userData = currentUser.data();
          
          await firestore().collection('notifications').add({
            type: 'like',
            postId: postId,
            senderId: userId,
            senderName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
            senderProfileImage: userData.profileImageURL || null,
            recipientId: postData.userId,
            message: 'liked your post',
            timestamp: firestore.FieldValue.serverTimestamp(),
            read: false
          });
        }
        
        return true;
      }
    } catch (error) {
      console.error('Toggle like error:', error);
      throw error;
    }
  }
};

/**
 * Block Service
 */
export const BlockService = {
  /**
   * Block a user
   * @param {string} userId - Current user ID
   * @param {string} blockedUserId - User to block
   * @param {string} reason - Reason for blocking
   * @returns {Promise<boolean>} - Success
   */
  blockUser: async (userId, blockedUserId, reason = '') => {
    try {
      // Check if already blocked
      const blockDoc = await firestore()
        .collection('blockedUsers')
        .where('userId', '==', userId)
        .where('blockedUserId', '==', blockedUserId)
        .limit(1)
        .get();
      
      if (!blockDoc.empty) {
        return true; // Already blocked
      }
      
      // Add to blocked users collection
      await firestore().collection('blockedUsers').add({
        userId,
        blockedUserId,
        reason,
        timestamp: firestore.FieldValue.serverTimestamp()
      });
      
      // Remove any existing connection
      await firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .where('connectedUserId', '==', blockedUserId)
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => {
            doc.ref.delete();
          });
        });
      
      // Remove connection in the other direction too
      await firestore()
        .collection('connections')
        .where('userId', '==', blockedUserId)
        .where('connectedUserId', '==', userId)
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => {
            doc.ref.delete();
          });
        });
      
      return true;
    } catch (error) {
      console.error('Block user error:', error);
      throw error;
    }
  },
  
  /**
   * Unblock a user
   * @param {string} userId - Current user ID
   * @param {string} blockedUserId - User to unblock
   * @returns {Promise<boolean>} - Success
   */
  unblockUser: async (userId, blockedUserId) => {
    try {
      // Find and delete the block document
      const blockDocs = await firestore()
        .collection('blockedUsers')
        .where('userId', '==', userId)
        .where('blockedUserId', '==', blockedUserId)
        .get();
      
      if (blockDocs.empty) {
        return true; // Not blocked, so already "unblocked"
      }
      
      // Delete all matching documents (should be just one)
      const batch = firestore().batch();
      blockDocs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Unblock user error:', error);
      throw error;
    }
  },
  
  /**
   * Get all blocked users for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array<string>>} - List of blocked user IDs
   */
  getBlockedUsers: async (userId) => {
    try {
      const snapshot = await firestore()
        .collection('blockedUsers')
        .where('userId', '==', userId)
        .get();
      
      return snapshot.docs.map(doc => doc.data().blockedUserId);
    } catch (error) {
      console.error('Get blocked users error:', error);
      return [];
    }
  },
  
  /**
   * Get detailed information about blocked users
   * @param {string} userId - User ID
   * @returns {Promise<Array<Object>>} - List of blocked user details
   */
  getBlockedUserDetails: async (userId) => {
    try {
      // Get all block documents
      const blockDocs = await firestore()
        .collection('blockedUsers')
        .where('userId', '==', userId)
        .get();
      
      if (blockDocs.empty) {
        return [];
      }
      
      // Get user details for each blocked user
      const blockedUserDetails = await Promise.all(
        blockDocs.docs.map(async (doc) => {
          const blockData = doc.data();
          const userDoc = await firestore()
            .collection('users')
            .doc(blockData.blockedUserId)
            .get();
          
          if (userDoc.exists) {
            return {
              id: blockData.blockedUserId,
              ...userDoc.data(),
              blockInfo: {
                reason: blockData.reason || '',
                timestamp: blockData.timestamp ? blockData.timestamp.toDate() : null
              }
            };
          }
          
          // Return minimal info if user doc doesn't exist
          return {
            id: blockData.blockedUserId,
            firstName: 'Deleted',
            lastName: 'User',
            blockInfo: {
              reason: blockData.reason || '',
              timestamp: blockData.timestamp ? blockData.timestamp.toDate() : null
            }
          };
        })
      );
      
      return blockedUserDetails;
    } catch (error) {
      console.error('Get blocked user details error:', error);
      throw error;
    }
  }
};

/**
 * Content Moderation Service
 */
export const ContentModerationService = {
  /**
   * Report content (post, comment, user)
   * @param {object} reportData - Report details
   * @returns {Promise<string>} - Report ID
   */
  reportContent: async (reportData) => {
    try {
      // Add required fields
      const data = {
        ...reportData,
        timestamp: firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        reviewed: false
      };
      
      // Add to Firestore
      const docRef = await firestore().collection('reports').add(data);
      return docRef.id;
    } catch (error) {
      console.error('Report content error:', error);
      throw error;
    }
  },
  
  /**
   * Moderate reported content
   * @param {string} reportId - Report ID
   * @param {object} moderationData - Moderation details
   * @returns {Promise<boolean>} - Success
   */
  moderateContent: async (reportId, moderationData) => {
    try {
      const reportRef = firestore().collection('reports').doc(reportId);
      const reportDoc = await reportRef.get();
      
      if (!reportDoc.exists) {
        throw new Error('Report not found');
      }
      
      // Update report with moderation details
      await reportRef.update({
        status: moderationData.decision,
        moderatorId: moderationData.moderatorId,
        moderatorNotes: moderationData.notes,
        reviewReason: moderationData.reason,
        reviewTimestamp: firestore.FieldValue.serverTimestamp(),
        reviewed: true
      });
      
      // If taking action, handle content removal or user warnings
      const reportData = reportDoc.data();
      
      if (moderationData.decision === 'remove') {
        // Handle content removal based on type
        if (reportData.type === 'post') {
          await PostService.deletePost(reportData.contentId);
        } else if (reportData.type === 'comment') {
          await firestore().collection('comments').doc(reportData.contentId).delete();
          
          // Update post's comment count
          if (reportData.postId) {
            await firestore()
              .collection('posts')
              .doc(reportData.postId)
              .update({
                commentCount: firestore.FieldValue.increment(-1)
              });
          }
        }
        
        // Notify user about content removal if applicable
        if (reportData.reportedUserId) {
          await firestore().collection('notifications').add({
            type: 'moderation',
            recipientId: reportData.reportedUserId,
            message: `Your ${reportData.type} has been removed for violating community guidelines`,
            timestamp: firestore.FieldValue.serverTimestamp(),
            read: false
          });
        }
      } else if (moderationData.decision === 'warn' && reportData.reportedUserId) {
        // Create warning notification for user
        await firestore().collection('notifications').add({
          type: 'warning',
          recipientId: reportData.reportedUserId,
          message: `Warning: Your recent ${reportData.type} may violate our community guidelines`,
          timestamp: firestore.FieldValue.serverTimestamp(),
          read: false
        });
        
        // Add to user warnings collection
        await firestore().collection('userWarnings').add({
          userId: reportData.reportedUserId,
          reportId: reportId,
          contentType: reportData.type,
          contentId: reportData.contentId,
          reason: moderationData.reason,
          timestamp: firestore.FieldValue.serverTimestamp()
        });
      }
      
      return true;
    } catch (error) {
      console.error('Moderate content error:', error);
      throw error;
    }
  }
};

export default {
  AuthService,
  UploadService,
  PostService,
  BlockService,
  ContentModerationService
};
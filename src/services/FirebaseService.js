// src/services/FirebaseService.js
// Centralized Firebase service with updated imports

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Alert } from 'react-native';

/**
 * Authentication Service
 * Handles user authentication functions
 */
export const AuthService = {
  /**
   * Sign in with email and password
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<UserCredential>} Firebase user credential
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
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<UserCredential>} Firebase user credential
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
   * 
   * @returns {Promise<void>}
   */
  signOut: async () => {
    try {
      return await auth().signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  /**
   * Reset password for email
   * 
   * @param {string} email - User email
   * @returns {Promise<void>}
   */
  resetPassword: async (email) => {
    try {
      return await auth().sendPasswordResetEmail(email);
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  },

  /**
   * Update user profile
   * 
   * @param {Object} user - Firebase user object
   * @param {Object} profileData - Profile data to update
   * @returns {Promise<void>}
   */
  updateProfile: async (user, profileData) => {
    try {
      // Update firestore user document
      const { displayName, photoURL, ...otherData } = profileData;
      
      // Update auth profile if displayName or photoURL provided
      if (displayName || photoURL) {
        const updateData = {};
        if (displayName) updateData.displayName = displayName;
        if (photoURL) updateData.photoURL = photoURL;
        
        await user.updateProfile(updateData);
      }
      
      // Update additional data in Firestore if provided
      if (Object.keys(otherData).length > 0) {
        await firestore().collection('users').doc(user.uid).update(otherData);
      }
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  },

  /**
   * Set up auth state change listener
   * 
   * @param {Function} callback - Callback function when auth state changes
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChanged: (callback) => {
    return auth().onAuthStateChanged(callback);
  },

  /**
   * Get current user
   * 
   * @returns {Object|null} Current Firebase user or null
   */
  getCurrentUser: () => {
    return auth().currentUser;
  }
};

/**
 * User Service
 * Handles user data operations
 */
export const UserService = {
  /**
   * Get user by ID
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User data
   */
  getUserById: async (userId) => {
    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }
      
      return {
        id: userDoc.id,
        ...userDoc.data(),
        joinDate: userDoc.data().joinDate?.toDate() || null
      };
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  },

  /**
   * Update user profile
   * 
   * @param {string} userId - User ID
   * @param {Object} data - Profile data to update
   * @returns {Promise<void>}
   */
  updateProfile: async (userId, data) => {
    try {
      return await firestore().collection('users').doc(userId).update(data);
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  },

  /**
   * Find users by condition
   * 
   * @param {string} condition - Medical condition to search
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} List of users
   */
  findUsersByCondition: async (condition, limit = 20) => {
    try {
      const snapshot = await firestore()
        .collection('users')
        .where('medicalConditions', 'array-contains', condition)
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        joinDate: doc.data().joinDate?.toDate() || null
      }));
    } catch (error) {
      console.error('Find users error:', error);
      throw error;
    }
  },

  /**
   * Search users by name or email
   * 
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} List of users
   */
  searchUsers: async (query, limit = 20) => {
    try {
      // Firebase doesn't support text search directly
      // This is a simple implementation that searches for users
      // whose name starts with the query
      const snapshot = await firestore()
        .collection('users')
        .orderBy('firstName')
        .startAt(query)
        .endAt(query + '\uf8ff')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        joinDate: doc.data().joinDate?.toDate() || null
      }));
    } catch (error) {
      console.error('Search users error:', error);
      throw error;
    }
  }
};

/**
 * Block Service
 * Handles user blocking functionality
 */
export const BlockService = {
  /**
   * Block a user
   * 
   * @param {string} userId - Current user ID
   * @param {string} blockedUserId - User ID to block
   * @param {string} reason - Reason for blocking
   * @returns {Promise<void>}
   */
  blockUser: async (userId, blockedUserId, reason = '') => {
    try {
      return await firestore().collection('blockedUsers').add({
        blockedBy: userId,
        blockedUserId,
        reason,
        timestamp: firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Block user error:', error);
      throw error;
    }
  },

  /**
   * Unblock a user
   * 
   * @param {string} userId - Current user ID
   * @param {string} blockedUserId - User ID to unblock
   * @returns {Promise<void>}
   */
  unblockUser: async (userId, blockedUserId) => {
    try {
      const snapshot = await firestore()
        .collection('blockedUsers')
        .where('blockedBy', '==', userId)
        .where('blockedUserId', '==', blockedUserId)
        .get();
      
      if (snapshot.empty) {
        return;
      }
      
      // Create a batch to delete all matching documents
      const batch = firestore().batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      return await batch.commit();
    } catch (error) {
      console.error('Unblock user error:', error);
      throw error;
    }
  },

  /**
   * Check if user is blocked
   * 
   * @param {string} userId - Current user ID
   * @param {string} otherUserId - User ID to check
   * @returns {Promise<boolean>} Whether the user is blocked
   */
  isUserBlocked: async (userId, otherUserId) => {
    try {
      const snapshot = await firestore()
        .collection('blockedUsers')
        .where('blockedBy', '==', userId)
        .where('blockedUserId', '==', otherUserId)
        .get();
      
      return !snapshot.empty;
    } catch (error) {
      console.error('Check blocked error:', error);
      throw error;
    }
  },

  /**
   * Get blocked users details
   * 
   * @param {string} userId - Current user ID
   * @returns {Promise<Array>} Blocked users details
   */
  getBlockedUserDetails: async (userId) => {
    try {
      const blockedSnapshot = await firestore()
        .collection('blockedUsers')
        .where('blockedBy', '==', userId)
        .get();
      
      if (blockedSnapshot.empty) {
        return [];
      }
      
      // Extract blocked user IDs and block info
      const blockedUserIds = [];
      const blockInfo = {};
      
      blockedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        blockedUserIds.push(data.blockedUserId);
        blockInfo[data.blockedUserId] = {
          reason: data.reason || '',
          timestamp: data.timestamp?.toDate() || null
        };
      });
      
      // Get user details in batches (Firestore limits "in" queries to 10 items)
      const userDetails = [];
      for (let i = 0; i < blockedUserIds.length; i += 10) {
        const batch = blockedUserIds.slice(i, i + 10);
        const usersSnapshot = await firestore()
          .collection('users')
          .where(firestore.FieldPath.documentId(), 'in', batch)
          .get();
        
        usersSnapshot.docs.forEach(doc => {
          userDetails.push({
            id: doc.id,
            ...doc.data(),
            blockInfo: blockInfo[doc.id]
          });
        });
      }
      
      return userDetails;
    } catch (error) {
      console.error('Get blocked users error:', error);
      throw error;
    }
  }
};

/**
 * Post Service
 * Handles post operations
 */
export const PostService = {
  /**
   * Create a new post
   * 
   * @param {Object} postData - Post data
   * @returns {Promise<string>} Post ID
   */
  createPost: async (postData) => {
    try {
      const postRef = await firestore().collection('posts').add({
        ...postData,
        timestamp: firestore.FieldValue.serverTimestamp(),
        likeCount: 0,
        commentCount: 0,
        likes: []
      });
      
      return postRef.id;
    } catch (error) {
      console.error('Create post error:', error);
      throw error;
    }
  },

  /**
   * Get post by ID
   * 
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
        timestamp: postDoc.data().timestamp?.toDate() || null
      };
    } catch (error) {
      console.error('Get post error:', error);
      throw error;
    }
  },

  /**
   * Update a post
   * 
   * @param {string} postId - Post ID
   * @param {Object} data - Post data to update
   * @returns {Promise<void>}
   */
  updatePost: async (postId, data) => {
    try {
      return await firestore().collection('posts').doc(postId).update(data);
    } catch (error) {
      console.error('Update post error:', error);
      throw error;
    }
  },

  /**
   * Delete a post
   * 
   * @param {string} postId - Post ID
   * @returns {Promise<void>}
   */
  deletePost: async (postId) => {
    try {
      // Get post to check for media content
      const postDoc = await firestore().collection('posts').doc(postId).get();
      const postData = postDoc.data();
      
      // Delete post document
      await firestore().collection('posts').doc(postId).delete();
      
      // Delete associated comments
      const commentsSnapshot = await firestore()
        .collection('comments')
        .where('postId', '==', postId)
        .get();
        
      const batch = firestore().batch();
      commentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (commentsSnapshot.docs.length > 0) {
        await batch.commit();
      }
      
      // Delete media if exists
      if (postData && postData.content && 
          (postData.type === 'image' || postData.type === 'video')) {
        try {
          const fileRef = storage().refFromURL(postData.content);
          await fileRef.delete();
        } catch (storageError) {
          console.error('Error deleting media:', storageError);
          // Continue even if media deletion fails
        }
      }
      
      return true;
    } catch (error) {
      console.error('Delete post error:', error);
      throw error;
    }
  },

  /**
   * Get feed posts
   * 
   * @param {string} userId - User ID
   * @param {Array} blockedUsers - List of blocked user IDs
   * @param {number} limit - Maximum number of posts
   * @param {Object} lastDoc - Last document for pagination
   * @returns {Promise<Array>} Feed posts
   */
  getFeedPosts: async (userId, blockedUsers = [], limit = 10, lastDoc = null) => {
    try {
      // Get user's connections
      const connectionsSnapshot = await firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .get();
      
      const connectedUserIds = connectionsSnapshot.docs.map(doc => doc.data().connectedUserId);
      
      // Include user's own posts
      const allUserIds = [...connectedUserIds, userId];
      
      // Filter out blocked users
      const filteredUserIds = allUserIds.filter(id => !blockedUsers.includes(id));
      
      // Create query
      let query = firestore().collection('posts');
      
      // Firestore 'in' operator can only take up to 10 values
      if (filteredUserIds.length <= 10) {
        query = query.where('userId', 'in', filteredUserIds.length > 0 ? filteredUserIds : [userId]);
      } else {
        // For more than 10 users, we need a different approach
        // This is a simplified approach using only the user's posts
        query = query.where('userId', '==', userId);
      }
      
      // Add ordering
      query = query.orderBy('timestamp', 'desc');
      
      // Add pagination
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      // Add limit
      query = query.limit(limit);
      
      // Execute query
      const postsSnapshot = await query.get();
      
      return {
        posts: postsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || null
        })),
        lastDoc: postsSnapshot.docs.length > 0 
          ? postsSnapshot.docs[postsSnapshot.docs.length - 1] 
          : null
      };
    } catch (error) {
      console.error('Get feed posts error:', error);
      throw error;
    }
  },

  /**
   * Toggle like on a post
   * 
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the post is liked after toggle
   */
  toggleLike: async (postId, userId) => {
    try {
      const postRef = firestore().collection('posts').doc(postId);
      
      // Use transaction to ensure consistency
      const result = await firestore().runTransaction(async transaction => {
        const postDoc = await transaction.get(postRef);
        
        if (!postDoc.exists) {
          throw new Error('Post does not exist');
        }
        
        const postData = postDoc.data();
        const likes = postData.likes || [];
        const isLiked = likes.includes(userId);
        
        if (isLiked) {
          // Unlike
          transaction.update(postRef, {
            likes: firestore.FieldValue.arrayRemove(userId),
            likeCount: firestore.FieldValue.increment(-1)
          });
          return false;
        } else {
          // Like
          transaction.update(postRef, {
            likes: firestore.FieldValue.arrayUnion(userId),
            likeCount: firestore.FieldValue.increment(1)
          });
          
          // Create notification for post author if needed
          if (postData.userId !== userId) {
            // Get user data for notification
            const userDoc = await transaction.get(
              firestore().collection('users').doc(userId)
            );
            
            if (userDoc.exists) {
              const userData = userDoc.data();
              const notificationRef = firestore().collection('notifications').doc();
              
              transaction.set(notificationRef, {
                type: 'like',
                senderId: userId,
                senderName: `${userData.firstName} ${userData.lastName}`,
                senderProfileImage: userData.profileImageURL,
                recipientId: postData.userId,
                postId: postId,
                message: 'liked your post',
                timestamp: firestore.FieldValue.serverTimestamp(),
                read: false
              });
            }
          }
          
          return true;
        }
      });
      
      return result;
    } catch (error) {
      console.error('Toggle like error:', error);
      throw error;
    }
  }
};

/**
 * Comment Service
 * Handles comment operations
 */
export const CommentService = {
  /**
   * Add a comment to a post
   * 
   * @param {Object} commentData - Comment data
   * @returns {Promise<string>} Comment ID
   */
  addComment: async (commentData) => {
    try {
      // Add comment
      const commentRef = await firestore().collection('comments').add({
        ...commentData,
        timestamp: firestore.FieldValue.serverTimestamp(),
        edited: false
      });
      
      // Update post comment count
      await firestore()
        .collection('posts')
        .doc(commentData.postId)
        .update({
          commentCount: firestore.FieldValue.increment(1)
        });
      
      // Create notification for post author if needed
      if (commentData.userId !== commentData.postAuthorId) {
        await firestore().collection('notifications').add({
          type: 'comment',
          senderId: commentData.userId,
          senderName: commentData.userFullName,
          senderProfileImage: commentData.userProfileImageURL,
          recipientId: commentData.postAuthorId,
          postId: commentData.postId,
          message: 'commented on your post',
          timestamp: firestore.FieldValue.serverTimestamp(),
          read: false
        });
      }
      
      return commentRef.id;
    } catch (error) {
      console.error('Add comment error:', error);
      throw error;
    }
  },

  /**
   * Get comments for a post
   * 
   * @param {string} postId - Post ID
   * @param {Array} blockedUsers - List of blocked user IDs
   * @returns {Promise<Array>} Comments
   */
  getComments: async (postId, blockedUsers = []) => {
    try {
      const commentsSnapshot = await firestore()
        .collection('comments')
        .where('postId', '==', postId)
        .orderBy('timestamp', 'asc')
        .get();
      
      // Filter out comments from blocked users
      return commentsSnapshot.docs
        .filter(doc => !blockedUsers.includes(doc.data().userId))
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || null,
          editTimestamp: doc.data().editTimestamp?.toDate() || null
        }));
    } catch (error) {
      console.error('Get comments error:', error);
      throw error;
    }
  },

  /**
   * Update a comment
   * 
   * @param {string} commentId - Comment ID
   * @param {string} text - Updated comment text
   * @returns {Promise<void>}
   */
  updateComment: async (commentId, text) => {
    try {
      return await firestore().collection('comments').doc(commentId).update({
        text,
        edited: true,
        editTimestamp: firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Update comment error:', error);
      throw error;
    }
  },

  /**
   * Delete a comment
   * 
   * @param {string} commentId - Comment ID
   * @param {string} postId - Post ID
   * @returns {Promise<void>}
   */
  deleteComment: async (commentId, postId) => {
    try {
      // Delete comment
      await firestore().collection('comments').doc(commentId).delete();
      
      // Update post comment count
      await firestore()
        .collection('posts')
        .doc(postId)
        .update({
          commentCount: firestore.FieldValue.increment(-1)
        });
      
      return true;
    } catch (error) {
      console.error('Delete comment error:', error);
      throw error;
    }
  }
};

/**
 * Connection Service
 * Handles user connections/following
 */
export const ConnectionService = {
  /**
   * Follow a user
   * 
   * @param {string} userId - Current user ID
   * @param {string} followUserId - User ID to follow
   * @returns {Promise<void>}
   */
  followUser: async (userId, followUserId) => {
    try {
      // Create connection
      await firestore().collection('connections').add({
        userId,
        connectedUserId: followUserId,
        timestamp: firestore.FieldValue.serverTimestamp()
      });
      
      // Create notification
      const userDoc = await firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      await firestore().collection('notifications').add({
        type: 'follow',
        senderId: userId,
        senderName: `${userData.firstName} ${userData.lastName}`,
        senderProfileImage: userData.profileImageURL,
        recipientId: followUserId,
        message: 'started following you',
        timestamp: firestore.FieldValue.serverTimestamp(),
        read: false
      });
      
      return true;
    } catch (error) {
      console.error('Follow user error:', error);
      throw error;
    }
  },

  /**
   * Unfollow a user
   * 
   * @param {string} userId - Current user ID
   * @param {string} followUserId - User ID to unfollow
   * @returns {Promise<void>}
   */
  unfollowUser: async (userId, followUserId) => {
    try {
      const connectionSnapshot = await firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .where('connectedUserId', '==', followUserId)
        .get();
      
      if (connectionSnapshot.empty) {
        return false;
      }
      
      // Delete the connection
      await connectionSnapshot.docs[0].ref.delete();
      
      return true;
    } catch (error) {
      console.error('Unfollow user error:', error);
      throw error;
    }
  },

  /**
   * Check if user is following another user
   * 
   * @param {string} userId - Current user ID
   * @param {string} followUserId - User ID to check
   * @returns {Promise<boolean>} Whether the user is following
   */
  isFollowing: async (userId, followUserId) => {
    try {
      const connectionSnapshot = await firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .where('connectedUserId', '==', followUserId)
        .get();
      
      return !connectionSnapshot.empty;
    } catch (error) {
      console.error('Is following error:', error);
      throw error;
    }
  },

  /**
   * Get user's followers
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of follower IDs
   */
  getFollowers: async (userId) => {
    try {
      const followersSnapshot = await firestore()
        .collection('connections')
        .where('connectedUserId', '==', userId)
        .get();
      
      return followersSnapshot.docs.map(doc => doc.data().userId);
    } catch (error) {
      console.error('Get followers error:', error);
      throw error;
    }
  },

  /**
   * Get users that a user is following
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of followed user IDs
   */
  getFollowing: async (userId) => {
    try {
      const followingSnapshot = await firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .get();
      
      return followingSnapshot.docs.map(doc => doc.data().connectedUserId);
    } catch (error) {
      console.error('Get following error:', error);
      throw error;
    }
  }
};

/**
 * Upload Service
 * Handles file uploads to Firebase Storage
 */
export const UploadService = {
  /**
   * Upload an image to Firebase Storage
   * 
   * @param {string} uri - Local image URI
   * @param {string} path - Storage path
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} Download URL
   */
  uploadImage: async (uri, path, onProgress = null) => {
    try {
      const reference = storage().ref(path);
      
      // Create upload task
      const task = reference.putFile(uri);
      
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
      throw error;
    }
  },

  /**
   * Upload a video to Firebase Storage
   * 
   * @param {string} uri - Local video URI
   * @param {string} path - Storage path
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} Download URL
   */
  uploadVideo: async (uri, path, onProgress = null) => {
    try {
      const reference = storage().ref(path);
      
      // Create upload task
      const task = reference.putFile(uri);
      
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
      console.error('Upload video error:', error);
      throw error;
    }
  },

  /**
   * Delete a file from Firebase Storage
   * 
   * @param {string} url - File download URL
   * @returns {Promise<void>}
   */
  deleteFile: async (url) => {
    try {
      const reference = storage().refFromURL(url);
      await reference.delete();
      return true;
    } catch (error) {
      console.error('Delete file error:', error);
      throw error;
    }
  }
};

/**
 * Notification Service
 * Handles user notifications
 */
export const NotificationService = {
  /**
   * Get notifications for a user
   * 
   * @param {string} userId - User ID
   * @param {Array} blockedUsers - List of blocked user IDs
   * @param {number} limit - Maximum number of notifications
   * @param {Object} lastDoc - Last document for pagination
   * @returns {Promise<Array>} User notifications
   */
  getNotifications: async (userId, blockedUsers = [], limit = 20, lastDoc = null) => {
    try {
      // Create query
      let query = firestore()
        .collection('notifications')
        .where('recipientId', '==', userId)
        .orderBy('timestamp', 'desc');
      
      // Add pagination
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      // Add limit
      query = query.limit(limit);
      
      // Execute query
      const snapshot = await query.get();
      
      // Filter out notifications from blocked users
      return {
        notifications: snapshot.docs
          .filter(doc => !blockedUsers.includes(doc.data().senderId))
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || null
          })),
        lastDoc: snapshot.docs.length > 0 
          ? snapshot.docs[snapshot.docs.length - 1] 
          : null
      };
    } catch (error) {
      console.error('Get notifications error:', error);
      throw error;
    }
  },

  /**
   * Mark notifications as read
   * 
   * @param {Array} notificationIds - Notification IDs
   * @returns {Promise<void>}
   */
  markAsRead: async (notificationIds) => {
    try {
      if (!notificationIds || notificationIds.length === 0) {
        return;
      }
      
      // Use batch for multiple updates
      const batch = firestore().batch();
      
      notificationIds.forEach(id => {
        const docRef = firestore().collection('notifications').doc(id);
        batch.update(docRef, { read: true });
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Mark notifications as read error:', error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read for a user
   * 
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  markAllAsRead: async (userId) => {
    try {
      // Find all unread notifications
      const snapshot = await firestore()
        .collection('notifications')
        .where('recipientId', '==', userId)
        .where('read', '==', false)
        .get();
      
      if (snapshot.empty) {
        return true;
      }
      
      // Use batch for multiple updates
      const batch = firestore().batch();
      
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      throw error;
    }
  },

  /**
   * Delete a notification
   * 
   * @param {string} notificationId - Notification ID
   * @returns {Promise<void>}
   */
  deleteNotification: async (notificationId) => {
    try {
      await firestore().collection('notifications').doc(notificationId).delete();
      return true;
    } catch (error) {
      console.error('Delete notification error:', error);
      throw error;
    }
  }
};

// Export a unified interface to all Firebase services
export default {
  AuthService,
  UserService,
  BlockService,
  PostService,
  CommentService,
  ConnectionService,
  UploadService,
  NotificationService
};
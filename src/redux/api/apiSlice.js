// src/redux/api/apiSlice.js
// Base API slice for RTK Query implementation

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import auth from '@react-native-firebase/auth';
import { FIREBASE_API_URL } from '@env';

// Create a base API with reusable configurations
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: FIREBASE_API_URL,
    prepareHeaders: async (headers) => {
      // Get the current user's ID token
      const currentUser = auth().currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        headers.set('Authorization', `Bearer ${token}`);
      }
      headers.set('Content-Type', 'application/json');
      return headers;
    },
  }),
  tagTypes: ['Posts', 'User', 'Comments', 'Likes', 'Notifications', 'Events', 'Chats'],
  endpoints: () => ({}),
});

// src/redux/api/postsApi.js
// RTK Query endpoints for posts

import { api } from './apiSlice';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// Convert Firestore data to JSON
const convertFirestoreData = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    timestamp: data.timestamp?.toDate().toISOString() || new Date().toISOString(),
  };
};

// Helper function to handle Firestore queries
const firestoreQuery = async ({ collection, where = [], orderBy, limit, startAfter }) => {
  let query = firestore().collection(collection);
  
  // Add where clauses
  where.forEach(([field, operator, value]) => {
    query = query.where(field, operator, value);
  });
  
  // Add orderBy
  if (orderBy) {
    query = query.orderBy(orderBy.field, orderBy.direction || 'desc');
  }
  
  // Add startAfter (for pagination)
  if (startAfter) {
    query = query.startAfter(startAfter);
  }
  
  // Add limit
  if (limit) {
    query = query.limit(limit);
  }
  
  // Execute query
  const snapshot = await query.get();
  
  // Convert to array of objects
  return {
    docs: snapshot.docs.map(convertFirestoreData),
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
  };
};

// Posts API slice
export const postsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get feed posts
    getFeedPosts: builder.query({
      queryFn: async ({ userId, blockedUsers = [], limit = 10, lastDoc }) => {
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
          
          // Firestore 'in' operator supports up to 10 values
          let postsQuery;
          if (filteredUserIds.length <= 10) {
            postsQuery = {
              collection: 'posts',
              where: [['userId', 'in', filteredUserIds.length > 0 ? filteredUserIds : [userId]]],
              orderBy: { field: 'timestamp', direction: 'desc' },
              limit,
              startAfter: lastDoc,
            };
          } else {
            // For more than 10 users, we need to do multiple queries and combine results
            // This is a simplified approach
            postsQuery = {
              collection: 'posts',
              where: [['userId', '==', userId]],
              orderBy: { field: 'timestamp', direction: 'desc' },
              limit,
              startAfter: lastDoc,
            };
            
            // Ideally, you'd implement a more sophisticated solution for larger numbers of connections
          }
          
          const { docs, lastDoc: newLastDoc } = await firestoreQuery(postsQuery);
          
          return { 
            data: { 
              posts: docs, 
              lastDoc: newLastDoc,
              hasMore: docs.length === limit 
            } 
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: (result) => 
        result?.posts
          ? [
              ...result.posts.map(({ id }) => ({ type: 'Posts', id })),
              { type: 'Posts', id: 'FEED' },
            ]
          : [{ type: 'Posts', id: 'FEED' }],
    }),
    
    // Get user posts
    getUserPosts: builder.query({
      queryFn: async ({ userId, limit = 10, lastDoc }) => {
        try {
          const postsQuery = {
            collection: 'posts',
            where: [['userId', '==', userId]],
            orderBy: { field: 'timestamp', direction: 'desc' },
            limit,
            startAfter: lastDoc,
          };
          
          const { docs, lastDoc: newLastDoc } = await firestoreQuery(postsQuery);
          
          return { 
            data: { 
              posts: docs, 
              lastDoc: newLastDoc,
              hasMore: docs.length === limit 
            } 
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: (result, error, { userId }) => 
        result?.posts
          ? [
              ...result.posts.map(({ id }) => ({ type: 'Posts', id })),
              { type: 'Posts', id: `USER_${userId}` },
            ]
          : [{ type: 'Posts', id: `USER_${userId}` }],
    }),
    
    // Get single post
    getPost: builder.query({
      queryFn: async (postId) => {
        try {
          const doc = await firestore().collection('posts').doc(postId).get();
          
          if (!doc.exists) {
            return { error: 'Post not found' };
          }
          
          return { data: convertFirestoreData(doc) };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: (result, error, id) => [{ type: 'Posts', id }],
    }),
    
    // Create post
    createPost: builder.mutation({
      queryFn: async (postData) => {
        try {
          // Handle image/video upload if needed
          let contentUrl = '';
          if (postData.type === 'image' && postData.imageUri) {
            // Upload image
            const filename = postData.imageUri.substring(postData.imageUri.lastIndexOf('/') + 1);
            const extension = filename.split('.').pop();
            const storagePath = `images/${postData.userId}_${Date.now()}.${extension}`;
            const reference = storage().ref(storagePath);
            
            await reference.putFile(postData.imageUri);
            contentUrl = await reference.getDownloadURL();
          } else if (postData.type === 'video' && postData.videoUri) {
            // Upload video
            const filename = postData.videoUri.substring(postData.videoUri.lastIndexOf('/') + 1);
            const extension = filename.split('.').pop();
            const storagePath = `videos/${postData.userId}_${Date.now()}.${extension}`;
            const reference = storage().ref(storagePath);
            
            await reference.putFile(postData.videoUri);
            contentUrl = await reference.getDownloadURL();
          } else if (postData.type === 'link') {
            contentUrl = postData.linkUrl;
          }
          
          // Create post document in Firestore
          const postRef = await firestore().collection('posts').add({
            userId: postData.userId,
            userFullName: postData.userFullName,
            userProfileImageURL: postData.userProfileImageURL,
            type: postData.type,
            content: contentUrl,
            caption: postData.caption.trim(),
            timestamp: firestore.FieldValue.serverTimestamp(),
            likeCount: 0,
            commentCount: 0,
            likes: []
          });
          
          return { data: { id: postRef.id } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: [{ type: 'Posts', id: 'FEED' }],
    }),
    
    // Update post
    updatePost: builder.mutation({
      queryFn: async ({ postId, updateData }) => {
        try {
          await firestore().collection('posts').doc(postId).update(updateData);
          return { data: { id: postId, ...updateData } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result, error, { postId }) => [{ type: 'Posts', id: postId }],
    }),
    
    // Delete post
    deletePost: builder.mutation({
      queryFn: async (postId) => {
        try {
          // Get post to check for media content that needs deletion
          const postDoc = await firestore().collection('posts').doc(postId).get();
          const postData = postDoc.data();
          
          // If post has image or video content, delete from storage
          if (postData && postData.content && (postData.type === 'image' || postData.type === 'video')) {
            const fileRef = storage().refFromURL(postData.content);
            await fileRef.delete();
          }
          
          // Delete post document
          await firestore().collection('posts').doc(postId).delete();
          
          // Delete all associated comments
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
          
          return { data: { id: postId } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result, error, postId) => [
        { type: 'Posts', id: postId },
        { type: 'Posts', id: 'FEED' },
        { type: 'Comments', id: `POST_${postId}` }
      ],
    }),
    
    // Toggle like on post
    toggleLike: builder.mutation({
      queryFn: async ({ postId, userId }) => {
        try {
          const postRef = firestore().collection('posts').doc(postId);
          
          // Run in transaction to ensure consistency
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
              return { isLiked: false };
            } else {
              // Like
              transaction.update(postRef, {
                likes: firestore.FieldValue.arrayUnion(userId),
                likeCount: firestore.FieldValue.increment(1)
              });
              
              // Create notification for post author if it's not the current user
              if (postData.userId !== userId) {
                const userDoc = await transaction.get(
                  firestore().collection('users').doc(userId)
                );
                const userData = userDoc.data();
                
                if (userData) {
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
              
              return { isLiked: true };
            }
          });
          
          return { data: { postId, userId, ...result } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result, error, { postId }) => [
        { type: 'Posts', id: postId },
        { type: 'Notifications', id: 'LIST' }
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetFeedPostsQuery,
  useGetUserPostsQuery,
  useGetPostQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  useToggleLikeMutation,
} = postsApi;

// src/redux/api/commentsApi.js
// RTK Query endpoints for comments

import { api } from './apiSlice';
import firestore from '@react-native-firebase/firestore';

export const commentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get comments for a post
    getComments: builder.query({
      queryFn: async ({ postId, blockedUsers = [], limit = 20, lastDoc }) => {
        try {
          let query = firestore()
            .collection('comments')
            .where('postId', '==', postId)
            .orderBy('timestamp', 'asc');
          
          if (lastDoc) {
            query = query.startAfter(lastDoc);
          }
          
          if (limit) {
            query = query.limit(limit);
          }
          
          const snapshot = await query.get();
          
          // Filter out comments from blocked users
          const comments = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString(),
              editTimestamp: doc.data().editTimestamp?.toDate().toISOString(),
            }))
            .filter(comment => !blockedUsers.includes(comment.userId));
          
          return { 
            data: { 
              comments, 
              lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
              hasMore: snapshot.docs.length === limit 
            } 
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: (result, error, { postId }) => 
        result?.comments
          ? [
              ...result.comments.map(({ id }) => ({ type: 'Comments', id })),
              { type: 'Comments', id: `POST_${postId}` },
            ]
          : [{ type: 'Comments', id: `POST_${postId}` }],
    }),
    
    // Add comment
    addComment: builder.mutation({
      queryFn: async (commentData) => {
        try {
          // Add comment to Firestore
          const commentRef = await firestore().collection('comments').add({
            postId: commentData.postId,
            userId: commentData.userId,
            userFullName: commentData.userFullName,
            userProfileImageURL: commentData.userProfileImageURL,
            text: commentData.text.trim(),
            timestamp: firestore.FieldValue.serverTimestamp(),
            edited: false
          });
          
          // Update comment count on the post
          await firestore()
            .collection('posts')
            .doc(commentData.postId)
            .update({
              commentCount: firestore.FieldValue.increment(1)
            });
          
          // Get post author to create notification
          const postDoc = await firestore()
            .collection('posts')
            .doc(commentData.postId)
            .get();
          
          const postData = postDoc.data();
          
          // Send notification to post author if it's not the current user
          if (postData && postData.userId !== commentData.userId) {
            await firestore().collection('notifications').add({
              type: 'comment',
              senderId: commentData.userId,
              senderName: commentData.userFullName,
              senderProfileImage: commentData.userProfileImageURL,
              recipientId: postData.userId,
              postId: commentData.postId,
              message: 'commented on your post',
              timestamp: firestore.FieldValue.serverTimestamp(),
              read: false
            });
          }
          
          return { 
            data: { 
              id: commentRef.id,
              ...commentData,
              timestamp: new Date().toISOString(),
              edited: false
            } 
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result, error, { postId }) => [
        { type: 'Comments', id: `POST_${postId}` },
        { type: 'Posts', id: postId },
        { type: 'Notifications', id: 'LIST' }
      ],
    }),
    
    // Update comment
    updateComment: builder.mutation({
      queryFn: async ({ commentId, text }) => {
        try {
          await firestore().collection('comments').doc(commentId).update({
            text: text.trim(),
            edited: true,
            editTimestamp: firestore.FieldValue.serverTimestamp()
          });
          
          return { 
            data: { 
              id: commentId, 
              text,
              edited: true,
              editTimestamp: new Date().toISOString()
            } 
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result, error, { commentId }) => [{ type: 'Comments', id: commentId }],
    }),
    
    // Delete comment
    deleteComment: builder.mutation({
      queryFn: async ({ commentId, postId }) => {
        try {
          // Delete comment
          await firestore().collection('comments').doc(commentId).delete();
          
          // Update comment count on post
          await firestore()
            .collection('posts')
            .doc(postId)
            .update({
              commentCount: firestore.FieldValue.increment(-1)
            });
          
          return { data: { commentId, postId } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result, error, { commentId, postId }) => [
        { type: 'Comments', id: commentId },
        { type: 'Comments', id: `POST_${postId}` },
        { type: 'Posts', id: postId }
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCommentsQuery,
  useAddCommentMutation,
  useUpdateCommentMutation,
  useDeleteCommentMutation,
} = commentsApi;

// src/redux/api/userApi.js
// RTK Query endpoints for user data

import { api } from './apiSlice';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';

export const userApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get user profile
    getUserProfile: builder.query({
      queryFn: async (userId) => {
        try {
          const userDoc = await firestore().collection('users').doc(userId).get();
          
          if (!userDoc.exists) {
            return { error: 'User not found' };
          }
          
          const userData = {
            id: userDoc.id,
            ...userDoc.data(),
            joinDate: userDoc.data().joinDate?.toDate().toISOString() || null,
          };
          
          return { data: userData };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),
    
    // Update user profile
    updateUserProfile: builder.mutation({
      queryFn: async ({ userId, updateData, profileImage }) => {
        try {
          const updates = { ...updateData };
          
          // Handle profile image upload if provided
          if (profileImage) {
            const filename = profileImage.uri.substring(profileImage.uri.lastIndexOf('/') + 1);
            const extension = filename.split('.').pop();
            const storagePath = `profiles/${userId}_${Date.now()}.${extension}`;
            const reference = storage().ref(storagePath);
            
            await reference.putFile(profileImage.uri);
            updates.profileImageURL = await reference.getDownloadURL();
          }
          
          // Update Firestore document
          await firestore().collection('users').doc(userId).update(updates);
          
          return { data: { id: userId, ...updates } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result, error, { userId }) => [{ type: 'User', id: userId }],
    }),
    
    // Get blocked users
    getBlockedUsers: builder.query({
      queryFn: async (userId) => {
        try {
          const snapshot = await firestore()
            .collection('blockedUsers')
            .where('blockedBy', '==', userId)
            .get();
          
          const blockedUsers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate().toISOString() || null,
          }));
          
          return { data: blockedUsers };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: [{ type: 'User', id: 'BLOCKED' }],
    }),
    
    // Block user
    blockUser: builder.mutation({
      queryFn: async ({ userId, blockedUserId, reason }) => {
        try {
          await firestore().collection('blockedUsers').add({
            blockedBy: userId,
            blockedUserId,
            reason: reason || null,
            timestamp: firestore.FieldValue.serverTimestamp(),
          });
          
          return { data: { userId, blockedUserId } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: [{ type: 'User', id: 'BLOCKED' }],
    }),
    
    // Unblock user
    unblockUser: builder.mutation({
      queryFn: async ({ userId, blockedUserId }) => {
        try {
          const snapshot = await firestore()
            .collection('blockedUsers')
            .where('blockedBy', '==', userId)
            .where('blockedUserId', '==', blockedUserId)
            .get();
          
          if (snapshot.empty) {
            return { error: 'Block record not found' };
          }
          
          // Delete all matching records (should only be one, but just in case)
          const batch = firestore().batch();
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          await batch.commit();
          
          return { data: { userId, blockedUserId } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: [{ type: 'User', id: 'BLOCKED' }],
    }),
    
    // Search users
    searchUsers: builder.query({
      queryFn: async ({ query, filter, limit = 20, lastDoc }) => {
        try {
          // Basic implementation - in a real app, you might use Algolia or another search service
          // This implementation is limited due to Firestore's limited query capabilities
          
          let firestoreQuery = firestore().collection('users').limit(limit);
          
          // Apply filters if provided
          if (filter?.condition) {
            firestoreQuery = firestoreQuery.where('medicalConditions', 'array-contains', filter.condition);
          }
          
          if (lastDoc) {
            firestoreQuery = firestoreQuery.startAfter(lastDoc);
          }
          
          const snapshot = await firestoreQuery.get();
          
          // Client-side filtering for text search
          let users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            joinDate: doc.data().joinDate?.toDate().toISOString() || null,
          }));
          
          // Filter by search query if provided
          if (query) {
            const searchLower = query.toLowerCase();
            users = users.filter(user => 
              (user.firstName && user.firstName.toLowerCase().includes(searchLower)) ||
              (user.lastName && user.lastName.toLowerCase().includes(searchLower)) ||
              (user.email && user.email.toLowerCase().includes(searchLower)) ||
              (user.medicalConditions && user.medicalConditions.some(condition => 
                condition.toLowerCase().includes(searchLower)
              ))
            );
          }
          
          return { 
            data: { 
              users, 
              lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
              hasMore: snapshot.docs.length === limit 
            } 
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: [{ type: 'User', id: 'SEARCH' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetUserProfileQuery,
  useUpdateUserProfileMutation,
  useGetBlockedUsersQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
  useSearchUsersQuery,
} = userApi;

// src/redux/api/notificationsApi.js
// RTK Query endpoints for notifications

import { api } from './apiSlice';
import firestore from '@react-native-firebase/firestore';

export const notificationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get user notifications
    getNotifications: builder.query({
      queryFn: async ({ userId, limit = 20, lastDoc }) => {
        try {
          let query = firestore()
            .collection('notifications')
            .where('recipientId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(limit);
          
          if (lastDoc) {
            query = query.startAfter(lastDoc);
          }
          
          const snapshot = await query.get();
          
          const notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString(),
          }));
          
          return { 
            data: { 
              notifications, 
              lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
              hasMore: snapshot.docs.length === limit,
              unreadCount: notifications.filter(n => !n.read).length,
            } 
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: [{ type: 'Notifications', id: 'LIST' }],
    }),
    
    // Mark notification as read
    markAsRead: builder.mutation({
      queryFn: async ({ notificationId }) => {
        try {
          await firestore()
            .collection('notifications')
            .doc(notificationId)
            .update({
              read: true
            });
          
          return { data: { id: notificationId, read: true } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: [{ type: 'Notifications', id: 'LIST' }],
    }),
    
    // Mark all notifications as read
    markAllAsRead: builder.mutation({
      queryFn: async (userId) => {
        try {
          const snapshot = await firestore()
            .collection('notifications')
            .where('recipientId', '==', userId)
            .where('read', '==', false)
            .get();
          
          if (snapshot.empty) {
            return { data: { success: true, count: 0 } };
          }
          
          const batch = firestore().batch();
          snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
          });
          
          await batch.commit();
          
          return { data: { success: true, count: snapshot.docs.length } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: [{ type: 'Notifications', id: 'LIST' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} = notificationsApi;

// src/redux/api/eventsApi.js
// RTK Query endpoints for virtual events

import { api } from './apiSlice';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

export const eventsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get events
    getEvents: builder.query({
      queryFn: async ({ filters = {}, limit = 10, lastDoc }) => {
        try {
          let query = firestore()
            .collection('events')
            .orderBy('startDate', 'asc')
            .where('startDate', '>=', new Date());
          
          // Apply filters
          if (filters.condition) {
            query = query.where('relatedConditions', 'array-contains', filters.condition);
          }
          
          if (filters.hostId) {
            query = query.where('hostId', '==', filters.hostId);
          }
          
          if (lastDoc) {
            query = query.startAfter(lastDoc);
          }
          
          query = query.limit(limit);
          
          const snapshot = await query.get();
          
          const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            startDate: doc.data().startDate?.toDate().toISOString() || null,
            endDate: doc.data().endDate?.toDate().toISOString() || null,
            createdAt: doc.data().createdAt?.toDate().toISOString() || null,
          }));
          
          return { 
            data: { 
              events, 
              lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
              hasMore: snapshot.docs.length === limit 
            } 
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: (result) => 
        result?.events
          ? [
              ...result.events.map(({ id }) => ({ type: 'Events', id })),
              { type: 'Events', id: 'LIST' },
            ]
          : [{ type: 'Events', id: 'LIST' }],
    }),
    
    // Get single event
    getEvent: builder.query({
      queryFn: async (eventId) => {
        try {
          const doc = await firestore().collection('events').doc(eventId).get();
          
          if (!doc.exists) {
            return { error: 'Event not found' };
          }
          
          const eventData = {
            id: doc.id,
            ...doc.data(),
            startDate: doc.data().startDate?.toDate().toISOString() || null,
            endDate: doc.data().endDate?.toDate().toISOString() || null,
            createdAt: doc.data().createdAt?.toDate().toISOString() || null,
          };
          
          return { data: eventData };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: (result, error, id) => [{ type: 'Events', id }],
    }),
    
    // Create event
    createEvent: builder.mutation({
      queryFn: async (eventData) => {
        try {
          const { imageUri, ...data } = eventData;
          
          // Upload image if provided
          let imageUrl = null;
          if (imageUri) {
            const filename = imageUri.substring(imageUri.lastIndexOf('/') + 1);
            const extension = filename.split('.').pop();
            const storagePath = `events/${data.hostId}_${Date.now()}.${extension}`;
            const reference = storage().ref(storagePath);
            
            await reference.putFile(imageUri);
            imageUrl = await reference.getDownloadURL();
          }
          
          // Create event document
          const eventRef = await firestore().collection('events').add({
            ...data,
            imageUrl,
            createdAt: firestore.FieldValue.serverTimestamp(),
            attendeeCount: 0,
            attendees: [],
          });
          
          return { 
            data: { 
              id: eventRef.id, 
              ...data, 
              imageUrl,
              createdAt: new Date().toISOString(),
              attendeeCount: 0,
              attendees: [], 
            } 
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: [{ type: 'Events', id: 'LIST' }],
    }),
    
    // Update event
    updateEvent: builder.mutation({
      queryFn: async ({ eventId, updateData, imageUri }) => {
        try {
          const updates = { ...updateData };
          
          // Upload image if provided
          if (imageUri) {
            const filename = imageUri.substring(imageUri.lastIndexOf('/') + 1);
            const extension = filename.split('.').pop();
            const storagePath = `events/${updates.hostId}_${Date.now()}.${extension}`;
            const reference = storage().ref(storagePath);
            
            await reference.putFile(imageUri);
            updates.imageUrl = await reference.getDownloadURL();
          }
          
          // Update event document
          await firestore().collection('events').doc(eventId).update(updates);
          
          return { data: { id: eventId, ...updates } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result, error, { eventId }) => [
        { type: 'Events', id: eventId },
        { type: 'Events', id: 'LIST' }
      ],
    }),
    
    // Delete event
    deleteEvent: builder.mutation({
      queryFn: async (eventId) => {
        try {
          // Get event to check for image that needs deletion
          const eventDoc = await firestore().collection('events').doc(eventId).get();
          const eventData = eventDoc.data();
          
          // If event has image, delete from storage
          if (eventData && eventData.imageUrl) {
            const fileRef = storage().refFromURL(eventData.imageUrl);
            await fileRef.delete();
          }
          
          // Delete event document
          await firestore().collection('events').doc(eventId).delete();
          
          return { data: { id: eventId } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result, error, eventId) => [
        { type: 'Events', id: eventId },
        { type: 'Events', id: 'LIST' }
      ],
    }),
    
    // RSVP to event
    toggleEventAttendance: builder.mutation({
      queryFn: async ({ eventId, userId, attending }) => {
        try {
          const eventRef = firestore().collection('events').doc(eventId);
          
          // Run in transaction to ensure consistency
          await firestore().runTransaction(async transaction => {
            const eventDoc = await transaction.get(eventRef);
            
            if (!eventDoc.exists) {
              throw new Error('Event does not exist');
            }
            
            if (attending) {
              // Add user to attendees
              transaction.update(eventRef, {
                attendees: firestore.FieldValue.arrayUnion(userId),
                attendeeCount: firestore.FieldValue.increment(1)
              });
            } else {
              // Remove user from attendees
              transaction.update(eventRef, {
                attendees: firestore.FieldValue.arrayRemove(userId),
                attendeeCount: firestore.FieldValue.increment(-1)
              });
            }
          });
          
          return { data: { eventId, userId, attending } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result, error, { eventId }) => [{ type: 'Events', id: eventId }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEventsQuery,
  useGetEventQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useToggleEventAttendanceMutation,
} = eventsApi;

// src/redux/api/chatApi.js
// RTK Query endpoints for chat functionality

import { api } from './apiSlice';
import firestore from '@react-native-firebase/firestore';

export const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Get user's conversations
    getConversations: builder.query({
      queryFn: async (userId) => {
        try {
          const snapshot = await firestore()
            .collection('conversations')
            .where('participants', 'array-contains', userId)
            .orderBy('lastMessageTimestamp', 'desc')
            .get();
          
          const conversations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            lastMessageTimestamp: doc.data().lastMessageTimestamp?.toDate().toISOString() || null,
          }));
          
          return { data: conversations };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: (result) => 
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Chats', id })),
              { type: 'Chats', id: 'LIST' },
            ]
          : [{ type: 'Chats', id: 'LIST' }],
    }),
    
    // Get messages for a conversation
    getMessages: builder.query({
      queryFn: async ({ conversationId, limit = 30, lastDoc }) => {
        try {
          let query = firestore()
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(limit);
          
          if (lastDoc) {
            query = query.startAfter(lastDoc);
          }
          
          const snapshot = await query.get();
          
          const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate().toISOString() || null,
          }));
          
          return { 
            data: { 
              messages, 
              lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
              hasMore: snapshot.docs.length === limit 
            } 
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      providesTags: (result, error, { conversationId }) => [
        { type: 'Chats', id: `MESSAGES_${conversationId}` }
      ],
    }),
    
    // Send message
    sendMessage: builder.mutation({
      queryFn: async ({ conversationId, message }) => {
        try {
          const { text, senderId, recipientId } = message;
          
          // Handle new conversation creation
          let actualConversationId = conversationId;
          
          if (!conversationId) {
            // Check if conversation already exists
            const conversationsSnapshot = await firestore()
              .collection('conversations')
              .where('participants', 'array-contains', senderId)
              .get();
            
            // Find conversation with both participants
            const existingConversation = conversationsSnapshot.docs.find(doc => {
              const participants = doc.data().participants || [];
              return participants.includes(recipientId);
            });
            
            if (existingConversation) {
              actualConversationId = existingConversation.id;
            } else {
              // Create new conversation
              const conversationRef = await firestore().collection('conversations').add({
                participants: [senderId, recipientId],
                created: firestore.FieldValue.serverTimestamp(),
                lastMessage: text,
                lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
                lastMessageSenderId: senderId,
              });
              
              actualConversationId = conversationRef.id;
            }
          }
          
          // Get sender and recipient data
          const [senderDoc, recipientDoc] = await Promise.all([
            firestore().collection('users').doc(senderId).get(),
            firestore().collection('users').doc(recipientId).get(),
          ]);
          
          const senderData = senderDoc.data();
          const recipientData = recipientDoc.data();
          
          // Add message to conversation
          const messageRef = await firestore()
            .collection('conversations')
            .doc(actualConversationId)
            .collection('messages')
            .add({
              text,
              senderId,
              senderName: `${senderData.firstName} ${senderData.lastName}`,
              senderProfileImage: senderData.profileImageURL,
              recipientId,
              recipientName: `${recipientData.firstName} ${recipientData.lastName}`,
              timestamp: firestore.FieldValue.serverTimestamp(),
              read: false,
            });
          
          // Update conversation with last message info
          await firestore()
            .collection('conversations')
            .doc(actualConversationId)
            .update({
              lastMessage: text,
              lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
              lastMessageSenderId: senderId,
            });
          
          return { 
            data: { 
              id: messageRef.id,
              conversationId: actualConversationId,
              text,
              senderId,
              timestamp: new Date().toISOString(),
              read: false,
            } 
          };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result) => [
        { type: 'Chats', id: `MESSAGES_${result.data.conversationId}` },
        { type: 'Chats', id: 'LIST' }
      ],
    }),
    
    // Mark messages as read
    markMessagesAsRead: builder.mutation({
      queryFn: async ({ conversationId, userId }) => {
        try {
          // Get unread messages sent to this user
          const messagesSnapshot = await firestore()
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .where('recipientId', '==', userId)
            .where('read', '==', false)
            .get();
          
          if (messagesSnapshot.empty) {
            return { data: { success: true, count: 0 } };
          }
          
          // Mark all as read
          const batch = firestore().batch();
          messagesSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, { read: true });
          });
          
          await batch.commit();
          
          return { data: { success: true, count: messagesSnapshot.docs.length } };
        } catch (error) {
          return { error: error.message };
        }
      },
      invalidatesTags: (result, error, { conversationId }) => [
        { type: 'Chats', id: `MESSAGES_${conversationId}` }
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetConversationsQuery,
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkMessagesAsReadMutation,
} = chatApi;
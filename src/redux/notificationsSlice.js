// src/redux/slices/notificationsSlice.js
// Notifications state management using Redux Toolkit

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import firestore from '@react-native-firebase/firestore';
import { withRetry } from '../../services/RetryService';
import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';

// Initial state
const initialState = {
  notifications: [],
  unreadCount: 0,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  lastFetchedAt: null,
};

/**
 * Fetch notifications
 */
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async ({ userId, limit = 50, lastDoc = null }, { rejectWithValue }) => {
    try {
      let query = firestore()
        .collection('notifications')
        .where('recipientId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await withRetry(() => query.get());
      
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      }));
      
      return { 
        notifications, 
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null 
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Mark notifications as read
 */
export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationIds, { rejectWithValue }) => {
    try {
      // Ensure notificationIds is an array
      const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
      
      // Use batch for efficiency
      const batch = firestore().batch();
      
      ids.forEach(id => {
        const ref = firestore().collection('notifications').doc(id);
        batch.update(ref, { read: true });
      });
      
      await withRetry(() => batch.commit());
      
      return { notificationIds: ids };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Mark all notifications as read
 */
export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (userId, { getState, rejectWithValue }) => {
    try {
      const snapshot = await withRetry(() => 
        firestore()
          .collection('notifications')
          .where('recipientId', '==', userId)
          .where('read', '==', false)
          .get()
      );
      
      if (snapshot.empty) {
        return { success: true, count: 0 };
      }
      
      const batch = firestore().batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
      });
      
      await withRetry(() => batch.commit());
      
      return { 
        success: true, 
        count: snapshot.docs.length,
        notificationIds: snapshot.docs.map(doc => doc.id)
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Delete notification
 */
export const deleteNotification = createAsyncThunk(
  'notifications/deleteNotification',
  async (notificationId, { rejectWithValue }) => {
    try {
      await withRetry(() => 
        firestore().collection('notifications').doc(notificationId).delete()
      );
      
      return { notificationId };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Create notification
 */
export const createNotification = createAsyncThunk(
  'notifications/createNotification',
  async (notificationData, { rejectWithValue }) => {
    try {
      const ref = await withRetry(() => 
        firestore().collection('notifications').add({
          ...notificationData,
          timestamp: firestore.FieldValue.serverTimestamp(),
          read: false
        })
      );
      
      return { 
        id: ref.id, 
        ...notificationData, 
        timestamp: new Date(),
        read: false
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Create the notifications slice
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Add a new notification (from push notification)
    addNotification: (state, action) => {
      state.notifications.unshift(action.payload);
      state.unreadCount += 1;
      
      // Update badge count on iOS
      if (Platform.OS === 'ios') {
        PushNotification.setApplicationIconBadgeNumber(state.unreadCount);
      }
    },
    
    // Reset notifications state
    resetNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
      state.status = 'idle';
      state.error = null;
      state.lastFetchedAt = null;
      
      // Clear badge count on iOS
      if (Platform.OS === 'ios') {
        PushNotification.setApplicationIconBadgeNumber(0);
      }
    },
    
    // Update badge count
    updateBadgeCount: (state) => {
      if (Platform.OS === 'ios') {
        PushNotification.setApplicationIconBadgeNumber(state.unreadCount);
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = 'succeeded';
        
        const newNotifications = action.payload.notifications.filter(
          notification => !state.notifications.some(n => n.id === notification.id)
        );
        
        // Add new notifications to the array
        state.notifications = [...state.notifications, ...newNotifications];
        
        // Count unread notifications
        state.unreadCount = state.notifications.filter(n => !n.read).length;
        
        // Update last fetched timestamp
        state.lastFetchedAt = new Date().toISOString();
        
        // Update badge count on iOS
        if (Platform.OS === 'ios') {
          PushNotification.setApplicationIconBadgeNumber(state.unreadCount);
        }
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // Mark as read
      .addCase(markAsRead.fulfilled, (state, action) => {
        const { notificationIds } = action.payload;
        
        // Update notifications
        state.notifications = state.notifications.map(notification => {
          if (notificationIds.includes(notification.id)) {
            return { ...notification, read: true };
          }
          return notification;
        });
        
        // Update unread count
        state.unreadCount = state.notifications.filter(n => !n.read).length;
        
        // Update badge count on iOS
        if (Platform.OS === 'ios') {
          PushNotification.setApplicationIconBadgeNumber(state.unreadCount);
        }
      })
      
      // Mark all as read
      .addCase(markAllAsRead.fulfilled, (state, action) => {
        if (action.payload.notificationIds) {
          // Update notifications with the specific IDs
          state.notifications = state.notifications.map(notification => {
            if (action.payload.notificationIds.includes(notification.id)) {
              return { ...notification, read: true };
            }
            return notification;
          });
        } else {
          // Mark all as read
          state.notifications = state.notifications.map(notification => ({
            ...notification,
            read: true
          }));
        }
        
        // Reset unread count
        state.unreadCount = 0;
        
        // Update badge count on iOS
        if (Platform.OS === 'ios') {
          PushNotification.setApplicationIconBadgeNumber(0);
        }
      })
      
      // Delete notification
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const { notificationId } = action.payload;
        
        // Check if the notification was unread
        const wasUnread = state.notifications.find(
          n => n.id === notificationId && !n.read
        );
        
        // Remove the notification
        state.notifications = state.notifications.filter(
          n => n.id !== notificationId
        );
        
        // Update unread count if needed
        if (wasUnread) {
          state.unreadCount -= 1;
          
          // Update badge count on iOS
          if (Platform.OS === 'ios') {
            PushNotification.setApplicationIconBadgeNumber(state.unreadCount);
          }
        }
      })
      
      // Create notification
      .addCase(createNotification.fulfilled, (state, action) => {
        state.notifications.unshift(action.payload);
        state.unreadCount += 1;
        
        // Update badge count on iOS
        if (Platform.OS === 'ios') {
          PushNotification.setApplicationIconBadgeNumber(state.unreadCount);
        }
      });
  },
});

// Export actions
export const { 
  addNotification, 
  resetNotifications,
  updateBadgeCount 
} = notificationsSlice.actions;

// Export selectors
export const selectAllNotifications = (state) => state.notifications.notifications;
export const selectUnreadCount = (state) => state.notifications.unreadCount;
export const selectNotificationsStatus = (state) => state.notifications.status;
export const selectNotificationsError = (state) => state.notifications.error;

// Export reducer
export default notificationsSlice.reducer;

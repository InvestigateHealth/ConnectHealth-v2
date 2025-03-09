// src/redux/slices/notificationsSlice.js
// Redux slice for managing notifications

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { NotificationService } from '../../services/FirebaseService';

// Initial state
const initialState = {
  notifications: [],
  unreadCount: 0,
  status: 'idle',
  error: null,
  lastFetchedAt: null,
};

// Async thunks
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async ({ userId, limit = 20, lastDoc = null }, { rejectWithValue }) => {
    try {
      const notifications = await NotificationService.getNotifications(userId, [], limit, lastDoc);
      return { 
        notifications: notifications.notifications, 
        lastDoc: notifications.lastDoc 
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationIds, { rejectWithValue }) => {
    try {
      await NotificationService.markAsRead(notificationIds);
      return { notificationIds };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (userId, { getState, rejectWithValue }) => {
    try {
      const { notifications } = getState().notifications;
      const unreadIds = notifications
        .filter(notification => !notification.read)
        .map(notification => notification.id);
      
      if (unreadIds.length === 0) return { success: true };
      
      await NotificationService.markAsRead(unreadIds);
      return { notificationIds: unreadIds };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Create slice
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Add a new notification (from push notification)
    addNotification: (state, action) => {
      state.notifications.unshift(action.payload);
      state.unreadCount += 1;
    },
    // Reset notifications state
    resetNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
      state.status = 'idle';
      state.error = null;
      state.lastFetchedAt = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = 'succeeded';
        
        // Add new notifications
        const newNotifications = action.payload.notifications.filter(
          notification => !state.notifications.some(n => n.id === notification.id)
        );
        
        // Calculate unread count
        const newUnreadCount = newNotifications.filter(n => !n.read).length;
        
        // Update state
        state.notifications = [...state.notifications, ...newNotifications];
        state.unreadCount += newUnreadCount;
        state.lastFetchedAt = new Date().toISOString();
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
      })
      // Mark all as read
      .addCase(markAllAsRead.fulfilled, (state, action) => {
        const { notificationIds } = action.payload;
        
        if (notificationIds) {
          // Update notifications
          state.notifications = state.notifications.map(notification => {
            if (notificationIds.includes(notification.id)) {
              return { ...notification, read: true };
            }
            return notification;
          });
        } else {
          // If no notification IDs provided, mark all as read
          state.notifications = state.notifications.map(notification => ({
            ...notification,
            read: true,
          }));
        }
        
        // Reset unread count
        state.unreadCount = 0;
      });
  },
});

export const { addNotification, resetNotifications } = notificationsSlice.actions;

export default notificationsSlice.reducer;
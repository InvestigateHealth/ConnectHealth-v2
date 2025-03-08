// src/services/NotificationService.js
// Push notifications implementation

import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../redux/store';
import { addNotification } from '../redux/slices/notificationsSlice';

// Notification channels for Android
const CHANNELS = {
  GENERAL: {
    id: 'general',
    name: 'General',
    description: 'General notifications',
    importance: 4, // High importance
    vibration: true,
  },
  LIKES: {
    id: 'likes',
    name: 'Likes',
    description: 'Like notifications',
    importance: 3, // Default importance
    vibration: true,
  },
  COMMENTS: {
    id: 'comments',
    name: 'Comments',
    description: 'Comment notifications',
    importance: 4, // High importance
    vibration: true,
  },
  FOLLOWS: {
    id: 'follows',
    name: 'Follows',
    description: 'Follow notifications',
    importance: 3, // Default importance
    vibration: true,
  },
  MESSAGES: {
    id: 'messages',
    name: 'Messages',
    description: 'Message notifications',
    importance: 5, // Maximum importance
    vibration: true,
  },
};

/**
 * Notification Service
 * 
 * Handles push notifications, permissions, and local notifications
 */
class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.messageListener = null;
    this.notificationOpenedListener = null;
  }

  /**
   * Initialize notification service
   */
  init() {
    if (this.isInitialized) return;
    
    this.configurePushNotifications();
    this.registerNotificationChannels();
    this.isInitialized = true;
  }

  /**
   * Configure push notifications
   */
  configurePushNotifications() {
    // Configure local notifications
    PushNotification.configure({
      // Called when a remote or local notification is opened or received
      onNotification: this.onNotification.bind(this),
      
      // IOS only (optional): default: all - Permission to register
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      
      // Should the initial notification be popped automatically
      popInitialNotification: true,
      
      /**
       * (optional) default: true
       * - Specified if permissions (iOS) and token (Android and iOS) will be requested or not,
       * - if not, you must call PushNotificationsHandler.requestPermissions() later
       */
      requestPermissions: false,
    });
    
    // Setup Firebase Messaging listeners
    if (messaging().isDeviceRegisteredForRemoteMessages) {
      this.setupMessageListeners();
    }
  }

  /**
   * Register notification channels for Android
   */
  registerNotificationChannels() {
    // Only required for Android
    if (Platform.OS === 'android') {
      // Remove old channels
      PushNotification.getChannels(channels => {
        for (const channel of channels) {
          PushNotification.deleteChannel(channel);
        }
      });
      
      // Create channels
      for (const channel of Object.values(CHANNELS)) {
        PushNotification.createChannel(
          {
            channelId: channel.id,
            channelName: channel.name,
            channelDescription: channel.description,
            importance: channel.importance,
            vibrate: channel.vibration,
          },
          created => console.log(`Channel ${channel.id} created: ${created}`)
        );
      }
    }
  }

  /**
   * Setup Firebase Messaging listeners
   */
  setupMessageListeners() {
    // Listen for FCM messages while app is in foreground
    this.messageListener = messaging().onMessage(async remoteMessage => {
      console.log('Foreground Message received:', remoteMessage);
      
      // Create local notification
      this.displayLocalNotification(remoteMessage);
      
      // Add to Redux store
      this.addToReduxStore(remoteMessage);
    });
    
    // Listen for FCM messages while app is in background
    this.notificationOpenedListener = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened app:', remoteMessage);
      
      // Handle notification navigation
      this.handleNotificationOpen(remoteMessage);
    });
    
    // Check if app was opened from a notification
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('App opened from notification:', remoteMessage);
          
          // Handle notification navigation after delay to ensure app is ready
          setTimeout(() => {
            this.handleNotificationOpen(remoteMessage);
          }, 1000);
        }
      });
  }

  /**
   * Clean up listeners
   */
  cleanup() {
    if (this.messageListener) {
      this.messageListener();
      this.messageListener = null;
    }
    
    if (this.notificationOpenedListener) {
      this.notificationOpenedListener();
      this.notificationOpenedListener = null;
    }
    
    this.isInitialized = false;
  }

  /**
   * Check notification permissions
   * 
   * @returns {Promise<Object>} Permission status
   */
  async checkPermissions() {
    // Request permission for iOS and Android 13+
    const authStatus = await messaging().hasPermission();
    
    // If permission isn't determined, request it
    if (authStatus === messaging.AuthorizationStatus.NOT_DETERMINED) {
      const requestStatus = await messaging().requestPermission();
      return requestStatus === messaging.AuthorizationStatus.AUTHORIZED ||
             requestStatus === messaging.AuthorizationStatus.PROVISIONAL;
    }
    
    return authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
           authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  }

  /**
   * Request notification permissions
   * 
   * @returns {Promise<boolean>} Whether permissions were granted
   */
  async requestPermissions() {
    try {
      const granted = await this.checkPermissions();
      
      if (granted) {
        // Register with FCM
        await this.registerDeviceForNotifications();
      }
      
      return granted;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Register device for notifications
   * 
   * @returns {Promise<string>} FCM token
   */
  async registerDeviceForNotifications() {
    try {
      const hasPermission = await this.checkPermissions();
      
      if (!hasPermission) {
        console.log('No notification permissions');
        return null;
      }
      
      // Register device with FCM
      await messaging().registerDeviceForRemoteMessages();
      
      // Get token
      const token = await messaging().getToken();
      console.log('FCM Token:', token);
      
      // Save token for later use
      await AsyncStorage.setItem('fcmToken', token);
      
      // Setup listeners if not already set up
      if (!this.messageListener) {
        this.setupMessageListeners();
      }
      
      return token;
    } catch (error) {
      console.error('Error registering for notifications:', error);
      return null;
    }
  }

  /**
   * Get notification token
   * 
   * @returns {Promise<string>} FCM token
   */
  async getToken() {
    try {
      // Try to get from AsyncStorage first
      const savedToken = await AsyncStorage.getItem('fcmToken');
      
      if (savedToken) {
        return savedToken;
      }
      
      // If not found, register and get new token
      return await this.registerDeviceForNotifications();
    } catch (error) {
      console.error('Error getting notification token:', error);
      return null;
    }
  }

  /**
   * Subscribe to topic
   * 
   * @param {string} topic - Topic to subscribe to
   * @returns {Promise<void>}
   */
  async subscribeToTopic(topic) {
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`Subscribed to topic: ${topic}`);
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
    }
  }

  /**
   * Unsubscribe from topic
   * 
   * @param {string} topic - Topic to unsubscribe from
   * @returns {Promise<void>}
   */
  async unsubscribeFromTopic(topic) {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`Unsubscribed from topic: ${topic}`);
    } catch (error) {
      console.error(`Error unsubscribing from topic ${topic}:`, error);
    }
  }

  /**
   * Display local notification
   * 
   * @param {Object} notification - Notification data
   */
  displayLocalNotification(notification) {
    const { notification: notificationData, data } = notification;
    
    if (!notificationData) return;
    
    const { title, body } = notificationData;
    const notificationType = data?.type || 'general';
    
    // Get channel ID based on notification type
    let channelId = CHANNELS.GENERAL.id;
    
    switch (notificationType) {
      case 'like':
        channelId = CHANNELS.LIKES.id;
        break;
      case 'comment':
        channelId = CHANNELS.COMMENTS.id;
        break;
      case 'follow':
        channelId = CHANNELS.FOLLOWS.id;
        break;
      case 'message':
        channelId = CHANNELS.MESSAGES.id;
        break;
    }
    
    // Create notification
    PushNotification.localNotification({
      /* Android Only Properties */
      channelId,
      largeIcon: 'ic_launcher',
      smallIcon: 'ic_notification',
      color: '#2196F3',
      vibrate: true,
      vibration: 300,
      priority: 'high',
      
      /* iOS and Android properties */
      title,
      message: body,
      userInfo: data,
      playSound: true,
      soundName: 'default',
    });
  }

  /**
   * Schedule a local notification
   * 
   * @param {Object} options - Notification options
   * @returns {string} Notification ID
   */
  scheduleLocalNotification(options) {
    const {
      title,
      message,
      data,
      type = 'general',
      date,
    } = options;
    
    // Get channel ID based on notification type
    let channelId = CHANNELS.GENERAL.id;
    
    switch (type) {
      case 'like':
        channelId = CHANNELS.LIKES.id;
        break;
      case 'comment':
        channelId = CHANNELS.COMMENTS.id;
        break;
      case 'follow':
        channelId = CHANNELS.FOLLOWS.id;
        break;
      case 'message':
        channelId = CHANNELS.MESSAGES.id;
        break;
    }
    
    // Generate notification ID
    const id = Math.floor(Math.random() * 1000000).toString();
    
    // Schedule notification
    PushNotification.localNotificationSchedule({
      /* Android Only Properties */
      id,
      channelId,
      largeIcon: 'ic_launcher',
      smallIcon: 'ic_notification',
      color: '#2196F3',
      vibrate: true,
      vibration: 300,
      priority: 'high',
      
      /* iOS and Android properties */
      title,
      message,
      userInfo: data,
      playSound: true,
      soundName: 'default',
      date: date || new Date(Date.now() + 5 * 1000), // 5 seconds from now
    });
    
    return id;
  }

  /**
   * Cancel a local notification
   * 
   * @param {string} id - Notification ID
   */
  cancelLocalNotification(id) {
    PushNotification.cancelLocalNotification(id);
  }

  /**
   * Cancel all local notifications
   */
  cancelAllLocalNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  /**
   * Handle when a notification is opened
   * 
   * @param {Object} notification - Notification data
   */
  onNotification(notification) {
    console.log('Notification received:', notification);
    
    // Handle notification open
    if (notification.userInteraction) {
      this.handleNotificationOpen(notification);
    }
    
    // Required on iOS only
    if (Platform.OS === 'ios') {
      notification.finish(PushNotificationIOS.FetchResult.NoData);
    }
  }

  /**
   * Handle navigation when a notification is opened
   * 
   * @param {Object} notification - Notification data
   */
  handleNotificationOpen(notification) {
    // Extract data from the notification
    const data = Platform.OS === 'android' 
      ? notification.data 
      : notification.userInfo;
    
    if (!data) return;
    
    const { type, postId, userId, conversationId } = data;
    
    // Import navigator service for navigation
    const { NavigationService } = require('./NavigationService');
    
    // Navigate based on notification type
    switch (type) {
      case 'like':
      case 'comment':
        if (postId) {
          NavigationService.navigate('Comments', { postId });
        }
        break;
      case 'follow':
        if (userId) {
          NavigationService.navigate('UserProfile', { userId });
        }
        break;
      case 'message':
        if (conversationId) {
          NavigationService.navigate('Conversation', { conversationId });
        }
        break;
      default:
        NavigationService.navigate('Notifications');
        break;
    }
  }

  /**
   * Add notification to Redux store
   * 
   * @param {Object} notification - Notification data
   */
  addToReduxStore(notification) {
    const { notification: notificationData, data } = notification;
    
    if (!notificationData || !data) return;
    
    // Create notification object
    const notificationObj = {
      id: Date.now().toString(),
      title: notificationData.title,
      body: notificationData.body,
      type: data.type || 'general',
      data,
      read: false,
      timestamp: new Date().toISOString(),
    };
    
    // Add to Redux store
    store.dispatch(addNotification(notificationObj));
  }

  /**
   * Get badge count
   * 
   * @returns {Promise<number>} Badge count
   */
  async getBadgeCount() {
    if (Platform.OS === 'ios') {
      return new Promise((resolve) => {
        PushNotificationIOS.getApplicationIconBadgeNumber(count => {
          resolve(count);
        });
      });
    }
    
    return 0;
  }

  /**
   * Set badge count
   * 
   * @param {number} count - Badge count
   */
  setBadgeCount(count) {
    // Set badge (iOS only)
    if (Platform.OS === 'ios') {
      PushNotificationIOS.setApplicationIconBadgeNumber(count);
    }
  }
}

// Create and export singleton instance
export const PushNotifications = new NotificationService();

// Helper function to handle notification setup
export const setupNotifications = async () => {
  // Initialize notification service
  PushNotifications.init();
  
  // Request permissions
  const hasPermission = await PushNotifications.requestPermissions();
  
  if (hasPermission) {
    console.log('Notification permissions granted');
    
    // Register with FCM
    const token = await PushNotifications.registerDeviceForNotifications();
    
    if (token) {
      console.log('Device registered for notifications');
      return true;
    }
  } else {
    console.log('Notification permissions denied');
  }
  
  return false;
};

// src/services/NavigationService.js
// Navigation helper service for push notifications

import { NavigationContainerRef } from '@react-navigation/native';
import React from 'react';

/**
 * Navigation service for handling navigation outside of components
 */
class NavigationServiceImpl {
  constructor() {
    this.navigator = React.createRef();
  }

  /**
   * Initialize with a navigation reference
   * 
   * @param {NavigationContainerRef} navigatorRef - Navigation reference
   */
  init(navigatorRef) {
    this.navigator = navigatorRef;
  }

  /**
   * Navigate to a screen
   * 
   * @param {string} name - Screen name
   * @param {Object} params - Screen parameters
   */
  navigate(name, params) {
    if (this.navigator.current) {
      this.navigator.current.navigate(name, params);
    }
  }

  /**
   * Go back to previous screen
   */
  goBack() {
    if (this.navigator.current) {
      this.navigator.current.goBack();
    }
  }

  /**
   * Reset navigation to a new state
   * 
   * @param {Object} state - New navigation state
   */
  reset(state) {
    if (this.navigator.current) {
      this.navigator.current.reset(state);
    }
  }

  /**
   * Get current route name
   * 
   * @returns {string} Current route name
   */
  getCurrentRouteName() {
    if (this.navigator.current) {
      return this.navigator.current.getCurrentRoute()?.name;
    }
    return null;
  }
}

// Create and export singleton instance
export const NavigationService = new NavigationServiceImpl();

// Export a provider component for initialization
export const NavigationProvider = ({ children }) => {
  const navigationRef = React.useRef(null);
  
  React.useEffect(() => {
    NavigationService.init(navigationRef);
  }, []);
  
  return (
    <NavigationContainer ref={navigationRef}>
      {children}
    </NavigationContainer>
  );
};

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
      return { notifications, lastDoc: notifications[notifications.length - 1] || null };
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

// src/hooks/useNotifications.js
// Hook for working with notifications

import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  fetchNotifications, 
  markAsRead, 
  markAllAsRead 
} from '../redux/slices/notificationsSlice';
import { PushNotifications } from '../services/NotificationService';
import { useUser } from './useUser';

/**
 * Hook for working with notifications
 */
export const useNotifications = () => {
  const dispatch = useDispatch();
  const { user } = useUser();
  const { 
    notifications, 
    unreadCount, 
    status, 
    error,
    lastFetchedAt 
  } = useSelector(state => state.notifications);
  const [loading, setLoading] = useState(status === 'loading');
  const [refreshing, setRefreshing] = useState(false);
  
  // Update loading state when status changes
  useEffect(() => {
    setLoading(status === 'loading');
  }, [status]);
  
  // Fetch notifications if needed
  useEffect(() => {
    if (user && (!lastFetchedAt || shouldRefresh(lastFetchedAt))) {
      loadNotifications();
    }
  }, [user]);
  
  // Check if we should refresh based on last fetch time
  const shouldRefresh = (lastFetch) => {
    if (!lastFetch) return true;
    
    const lastFetchTime = new Date(lastFetch).getTime();
    const now = new Date().getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    
    return now - lastFetchTime > fifteenMinutes;
  };
  
  // Load notifications
  const loadNotifications = async () => {
    if (!user) return;
    
    try {
      await dispatch(fetchNotifications({ userId: user.uid })).unwrap();
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };
  
  // Load more notifications
  const loadMoreNotifications = async () => {
    if (!user || loading || notifications.length === 0) return;
    
    try {
      const lastNotification = notifications[notifications.length - 1];
      await dispatch(fetchNotifications({ 
        userId: user.uid, 
        lastDoc: lastNotification 
      })).unwrap();
    } catch (error) {
      console.error('Error loading more notifications:', error);
    }
  };
  
  // Refresh notifications
  const refreshNotifications = async () => {
    if (!user) return;
    
    setRefreshing(true);
    try {
      await dispatch(fetchNotifications({ userId: user.uid })).unwrap();
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Mark notification as read
  const markNotificationAsRead = async (notificationId) => {
    if (!user) return;
    
    try {
      await dispatch(markAsRead([notificationId])).unwrap();
      
      // Update badge count
      if (unreadCount > 0) {
        PushNotifications.setBadgeCount(unreadCount - 1);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };
  
  // Mark all notifications as read
  const markAllNotificationsAsRead = async () => {
    if (!user) return;
    
    try {
      await dispatch(markAllAsRead(user.uid)).unwrap();
      
      // Reset badge count
      PushNotifications.setBadgeCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };
  
  // Set up notification handling
  const setupNotifications = async () => {
    try {
      return await PushNotifications.requestPermissions();
    } catch (error) {
      console.error('Error setting up notifications:', error);
      return false;
    }
  };
  
  return {
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    loadNotifications,
    loadMoreNotifications,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    setupNotifications,
  };
};

// Example NotificationsScreen implementation using the hook
/*
import React from 'react';
import { View, FlatList, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationItem } from '../components/NotificationItem';

export const NotificationsScreen = () => {
  const { 
    notifications, 
    unreadCount, 
    loading, 
    refreshing,
    loadMoreNotifications,
    refreshNotifications,
    markAllNotificationsAsRead,
  } = useNotifications();
  
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Notifications</Text>
        
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllNotificationsAsRead}>
            <Text style={{ color: '#2196F3' }}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={notifications}
        renderItem={({ item }) => <NotificationItem notification={item} />}
        keyExtractor={item => item.id}
        refreshing={refreshing}
        onRefresh={refreshNotifications}
        onEndReached={loadMoreNotifications}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text>No notifications yet</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading && notifications.length > 0 ? (
            <ActivityIndicator style={{ padding: 20 }} />
          ) : null
        }
      />
    </View>
  );
};
*/
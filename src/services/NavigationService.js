// src/services/NotificationService.js
// Modern notification service using Notifee

import notifee, { 
  AndroidImportance, 
  AndroidVisibility, 
  EventType, 
  AndroidCategory 
} from '@notifee/react-native';
import { Platform } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

class NotificationService {
  constructor() {
    this.hasInitialized = false;
    this.messageListeners = [];
    this.notificationListeners = [];
    this.userId = null;
    this.defaultChannelId = null;
    this.unsubscribeFirestoreListener = null;
  }

  /**
   * Initialize the notification service
   * @param {string} userId - The ID of the currently logged in user
   */
  async initialize(userId) {
    if (this.hasInitialized) return;
    
    this.userId = userId;
    
    // Create default notification channel for Android
    if (Platform.OS === 'android') {
      this.defaultChannelId = await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        vibration: true,
        sound: 'default',
      });
      
      // Create additional channels for different notification types
      await notifee.createChannel({
        id: 'messages',
        name: 'Messages',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PRIVATE,
        vibration: true,
        sound: 'default',
        category: AndroidCategory.MESSAGE,
      });
      
      await notifee.createChannel({
        id: 'events',
        name: 'Events',
        importance: AndroidImportance.DEFAULT,
        visibility: AndroidVisibility.PUBLIC,
        vibration: true,
        sound: 'default',
      });
    }
    
    // Request permission for iOS
    if (Platform.OS === 'ios') {
      await this.requestPermission();
    }
    
    // Set up listeners
    this.setupEventListeners();
    
    // Initialize Firebase Cloud Messaging
    await this.initializeMessaging();
    
    this.hasInitialized = true;
  }

  /**
   * Request permission to send notifications
   * @returns {Promise<boolean>} Whether permission was granted
   */
  async requestPermission() {
    try {
      const settings = await notifee.requestPermission({
        sound: true,
        alert: true,
        badge: true,
        provisional: false,
        criticalAlert: true,
      });
      
      return settings.authorizationStatus > 0;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Set up notification event listeners
   */
  setupEventListeners() {
    // Set up listeners for notification events
    this.foregroundUnsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      switch (type) {
        case EventType.DISMISSED:
          this.notificationListeners.forEach(listener => {
            if (listener.onDismissed) {
              listener.onDismissed(detail.notification);
            }
          });
          break;
          
        case EventType.PRESS:
          this.notificationListeners.forEach(listener => {
            if (listener.onPressed) {
              listener.onPressed(detail.notification);
            }
          });
          break;
          
        case EventType.ACTION_PRESS:
          this.notificationListeners.forEach(listener => {
            if (listener.onActionPressed) {
              listener.onActionPressed(detail.pressAction, detail.notification);
            }
          });
          break;
      }
    });
    
    // Background events
    this.backgroundUnsubscribe = notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS) {
        // Handle background notification press
        const { notification } = detail;
        await this.handleNotificationPress(notification);
      }
    });
  }

  /**
   * Initialize Firebase Cloud Messaging
   */
  async initializeMessaging() {
    try {
      // Request permission for FCM (Firebase Cloud Messaging)
      const authStatus = await messaging().requestPermission();
      const enabled = 
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      if (!enabled) {
        console.log('Firebase messaging permission not granted');
        return;
      }
      
      // Get FCM token
      const token = await messaging().getToken();
      if (this.userId && token) {
        await this.saveDeviceToken(token);
      }
      
      // Listen for token refreshes
      this.onTokenRefreshUnsubscribe = messaging().onTokenRefresh(async (newToken) => {
        if (this.userId) {
          await this.saveDeviceToken(newToken);
        }
      });
      
      // Handle foreground messages
      this.onMessageUnsubscribe = messaging().onMessage(async (remoteMessage) => {
        await this.displayNotificationFromFCM(remoteMessage);
      });
      
      // Handle background/quit state messages
      messaging().setBackgroundMessageHandler(async (remoteMessage) => {
        await this.displayNotificationFromFCM(remoteMessage);
      });
      
      // Get initial notification if the app was opened from a notification
      const initialNotification = await messaging().getInitialNotification();
      if (initialNotification) {
        await this.handleNotificationPress(initialNotification);
      }
    } catch (error) {
      console.error('Error initializing Firebase messaging:', error);
    }
  }

  /**
   * Display a notification from FCM remote message
   * @param {Object} remoteMessage - The Firebase remote message
   */
  async displayNotificationFromFCM(remoteMessage) {
    try {
      const { notification, data } = remoteMessage;
      
      // Determine which channel to use
      let channelId = this.defaultChannelId;
      if (data?.type === 'message') {
        channelId = 'messages';
      } else if (data?.type === 'event') {
        channelId = 'events';
      }
      
      // Create notification
      await notifee.displayNotification({
        title: notification?.title || data?.title,
        body: notification?.body || data?.body,
        data: data || {},
        android: {
          channelId,
          smallIcon: 'ic_notification',
          color: '#2196F3',
          pressAction: {
            id: 'default',
          },
          actions: this.getActionsFromData(data),
        },
        ios: {
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
          },
          categoryId: data?.categoryId,
        },
      });
      
      // Notify listeners
      this.messageListeners.forEach(listener => {
        if (listener.onMessageReceived) {
          listener.onMessageReceived(remoteMessage);
        }
      });
    } catch (error) {
      console.error('Error displaying FCM notification:', error);
    }
  }

  /**
   * Get notification actions based on data
   * @param {Object} data - Notification data
   * @returns {Array} Array of actions
   */
  getActionsFromData(data) {
    const actions = [];
    
    if (!data) return actions;
    
    // For messages, add quick reply action
    if (data.type === 'message') {
      actions.push({
        title: 'Reply',
        pressAction: {
          id: 'reply',
        },
        input: {
          placeholder: 'Type your reply...',
          allowFreeFormInput: true,
        },
      });
    }
    
    // For events, add RSVP actions
    if (data.type === 'event') {
      actions.push(
        {
          title: 'Attend',
          pressAction: {
            id: 'attend',
          },
        },
        {
          title: 'Decline',
          pressAction: {
            id: 'decline',
          },
        }
      );
    }
    
    return actions;
  }

  /**
   * Handle notification press
   * @param {Object} notification - The notification that was pressed
   */
  async handleNotificationPress(notification) {
    if (!notification) return;
    
    // Mark notification as read in database
    try {
      if (notification.data && notification.data.notificationId && this.userId) {
        await firestore()
          .collection('notifications')
          .doc(notification.data.notificationId)
          .update({
            read: true,
            readAt: firestore.FieldValue.serverTimestamp()
          });
      }
      
      // Navigate based on notification type
      this.notificationListeners.forEach(listener => {
        if (listener.onPressed) {
          listener.onPressed(notification);
        }
      });
    } catch (error) {
      console.error('Error handling notification press:', error);
    }
  }

  /**
   * Save device token to user's document
   * @param {string} token - The FCM token
   */
  async saveDeviceToken(token) {
    try {
      if (!this.userId || !token) return;
      
      await firestore()
        .collection('users')
        .doc(this.userId)
        .update({
          deviceTokens: firestore.FieldValue.arrayUnion(token),
          lastTokenUpdate: firestore.FieldValue.serverTimestamp()
        });
      
      // Store locally
      await AsyncStorage.setItem('fcmToken', token);
    } catch (error) {
      console.error('Error saving device token:', error);
    }
  }

  /**
   * Remove device token when user logs out
   */
  async removeDeviceToken() {
    try {
      if (!this.userId) return;
      
      const token = await AsyncStorage.getItem('fcmToken');
      if (token) {
        await firestore()
          .collection('users')
          .doc(this.userId)
          .update({
            deviceTokens: firestore.FieldValue.arrayRemove(token)
          });
        
        await AsyncStorage.removeItem('fcmToken');
      }
    } catch (error) {
      console.error('Error removing device token:', error);
    }
  }

  /**
   * Display a local notification
   * @param {Object} options - Notification options
   */
  async displayNotification(options) {
    try {
      const {
        title,
        body,
        data = {},
        android = {},
        ios = {},
        actions = []
      } = options;
      
      // Determine which channel to use
      let channelId = android.channelId || this.defaultChannelId;
      
      // Create notification
      await notifee.displayNotification({
        title,
        body,
        data,
        android: {
          channelId,
          smallIcon: android.smallIcon || 'ic_notification',
          color: android.color || '#2196F3',
          pressAction: android.pressAction || {
            id: 'default',
          },
          actions: actions.map(action => ({
            title: action.title,
            pressAction: {
              id: action.id,
            },
            input: action.input,
          })),
          ...android,
        },
        ios: {
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
          },
          ...ios,
        },
      });
    } catch (error) {
      console.error('Error displaying local notification:', error);
    }
  }

  /**
   * Schedule a notification for future delivery
   * @param {Object} options - Notification options
   * @param {Date} date - When to show the notification
   * @returns {string} Notification ID
   */
  async scheduleNotification(options, date) {
    try {
      const {
        title,
        body,
        data = {},
        android = {},
        ios = {},
        actions = []
      } = options;
      
      // Determine which channel to use
      let channelId = android.channelId || this.defaultChannelId;
      
      // Create trigger
      const trigger = {
        type: 'timestamp',
        timestamp: date.getTime(),
      };
      
      // Schedule notification
      const notificationId = await notifee.createTriggerNotification(
        {
          title,
          body,
          data,
          android: {
            channelId,
            smallIcon: android.smallIcon || 'ic_notification',
            color: android.color || '#2196F3',
            pressAction: android.pressAction || {
              id: 'default',
            },
            actions: actions.map(action => ({
              title: action.title,
              pressAction: {
                id: action.id,
              },
              input: action.input,
            })),
            ...android,
          },
          ios: {
            foregroundPresentationOptions: {
              alert: true,
              badge: true,
              sound: true,
            },
            ...ios,
          },
        },
        trigger
      );
      
      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  /**
   * Cancel a scheduled notification
   * @param {string} notificationId - ID of the notification to cancel
   */
  async cancelNotification(notificationId) {
    try {
      await notifee.cancelNotification(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications() {
    try {
      await notifee.cancelAllNotifications();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  /**
   * Get badge count
   * @returns {Promise<number>} Current badge count
   */
  async getBadgeCount() {
    try {
      const badgeCount = await notifee.getBadgeCount();
      return badgeCount;
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Set badge count
   * @param {number} count - New badge count
   */
  async setBadgeCount(count) {
    try {
      await notifee.setBadgeCount(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  /**
   * Increment badge count
   * @param {number} increment - Amount to increment by
   */
  async incrementBadgeCount(increment = 1) {
    try {
      const currentCount = await this.getBadgeCount();
      await this.setBadgeCount(currentCount + increment);
    } catch (error) {
      console.error('Error incrementing badge count:', error);
    }
  }

  /**
   * Add a message listener
   * @param {Object} listener - The listener object
   */
  addMessageListener(listener) {
    this.messageListeners.push(listener);
  }

  /**
   * Remove a message listener
   * @param {Object} listener - The listener to remove
   */
  removeMessageListener(listener) {
    this.messageListeners = this.messageListeners.filter(l => l !== listener);
  }

  /**
   * Add a notification listener
   * @param {Object} listener - The listener object
   */
  addNotificationListener(listener) {
    this.notificationListeners.push(listener);
  }

  /**
   * Remove a notification listener
   * @param {Object} listener - The listener to remove
   */
  removeNotificationListener(listener) {
    this.notificationListeners = this.notificationListeners.filter(l => l !== listener);
  }

  /**
   * Set up a Firestore listener for new notifications
   */
  setupFirestoreNotificationListener() {
    if (!this.userId || this.unsubscribeFirestoreListener) return;
    
    this.unsubscribeFirestoreListener = firestore()
      .collection('notifications')
      .where('recipientId', '==', this.userId)
      .where('read', '==', false)
      .orderBy('timestamp', 'desc')
      .onSnapshot(async snapshot => {
        // Check for new notifications
        const changes = snapshot.docChanges();
        const newNotifications = changes.filter(change => change.type === 'added');
        
        if (newNotifications.length > 0) {
          // Update badge count
          await this.incrementBadgeCount(newNotifications.length);
          
          // Display local notifications for each new notification
          for (const change of newNotifications) {
            const notification = change.doc.data();
            
            await this.displayNotification({
              title: notification.title || 'New Notification',
              body: notification.body,
              data: {
                ...notification,
                notificationId: change.doc.id
              }
            });
          }
        }
      }, error => {
        console.error('Error in Firestore notification listener:', error);
      });
  }

  /**
   * Clean up all listeners
   */
  cleanup() {
    if (this.foregroundUnsubscribe) {
      this.foregroundUnsubscribe();
    }
    
    if (this.backgroundUnsubscribe) {
      this.backgroundUnsubscribe();
    }
    
    if (this.onTokenRefreshUnsubscribe) {
      this.onTokenRefreshUnsubscribe();
    }
    
    if (this.onMessageUnsubscribe) {
      this.onMessageUnsubscribe();
    }
    
    if (this.unsubscribeFirestoreListener) {
      this.unsubscribeFirestoreListener();
    }
    
    this.messageListeners = [];
    this.notificationListeners = [];
    this.userId = null;
    this.hasInitialized = false;
  }
}
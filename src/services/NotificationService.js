// src/services/NotificationService.js
// Enhanced Notification Service with better error handling and token management

import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import { AnalyticsService } from './AnalyticsService';

class NotificationService {
  constructor() {
    this.initialized = false;
    this.userId = null;
    this.fcmToken = null;
    this.channels = {
      messages: {
        id: 'messages',
        name: 'Messages',
        description: 'Notifications for new messages',
        importance: AndroidImportance.HIGH,
      },
      events: {
        id: 'events',
        name: 'Events',
        description: 'Notifications for events',
        importance: AndroidImportance.DEFAULT,
      },
      reminders: {
        id: 'reminders',
        name: 'Reminders',
        description: 'Notifications for reminders',
        importance: AndroidImportance.HIGH,
      },
      system: {
        id: 'system',
        name: 'System',
        description: 'System notifications',
        importance: AndroidImportance.LOW,
      }
    };
  }

  async initialize(userId) {
    if (this.initialized && this.userId === userId) {
      return;
    }
    
    this.userId = userId;
    
    try {
      // Create notification channels for Android
      if (Platform.OS === 'android') {
        await this.createChannels();
      }
      
      // Request permission
      await this.requestPermission();
      
      // Get and save FCM token
      await this.updateFcmToken();
      
      // Set up notification handlers
      this.setupHandlers();
      
      this.initialized = true;
      
      AnalyticsService.logEvent('notification_service_initialized', {
        success: true,
      });
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      AnalyticsService.logError(error, { context: 'notification_initialization' });
    }
  }
  
  async createChannels() {
    try {
      // Create channels from the defined channel configuration
      for (const [, channel] of Object.entries(this.channels)) {
        await notifee.createChannel(channel);
      }
    } catch (error) {
      console.error('Error creating notification channels:', error);
      AnalyticsService.logError(error, { context: 'create_notification_channels' });
    }
  }
  
  async requestPermission() {
    try {
      // Request notification permission from the user
      const authStatus = await messaging().requestPermission();
      const enabled = 
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        
      // Log the permission status for analytics
      AnalyticsService.logEvent('notification_permission', {
        granted: enabled,
        status: authStatus
      });
      
      // Also request permission through notifee
      await notifee.requestPermission({
        sound: true,
        alert: true,
        badge: true,
        criticalAlert: false,
        provisional: true
      });
      
      return enabled;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      AnalyticsService.logError(error, { context: 'request_notification_permission' });
      return false;
    }
  }
  
  async updateFcmToken() {
    try {
      // Get the FCM token
      const token = await messaging().getToken();
      
      if (!token) {
        throw new Error('Failed to get FCM token');
      }
      
      // Check if token has changed
      const oldToken = await AsyncStorage.getItem('fcmToken');
      
      if (token !== oldToken) {
        // Save the new token
        await AsyncStorage.setItem('fcmToken', token);
        this.fcmToken = token;
        
        // Update the token in Firestore
        if (this.userId) {
          await firestore().collection('users').doc(this.userId).update({
            fcmTokens: firestore.FieldValue.arrayUnion({
              token,
              device: Platform.OS,
              createdAt: firestore.FieldValue.serverTimestamp()
            })
          });
          
          // Log token update
          AnalyticsService.logEvent('fcm_token_updated', {
            success: true,
            platform: Platform.OS
          });
        }
      } else {
        this.fcmToken = token;
      }
      
      return token;
    } catch (error) {
      console.error('Error updating FCM token:', error);
      AnalyticsService.logError(error, { context: 'update_fcm_token' });
      return null;
    }
  }
  
  setupHandlers() {
    // Handle FCM messages in foreground
    this.messageUnsubscribe = messaging().onMessage(async (remoteMessage) => {
      try {
        AnalyticsService.logEvent('notification_received', {
          type: remoteMessage.data?.type || 'unknown',
          inForeground: true
        });
        
        // Display the notification using notifee
        await this.displayNotification(remoteMessage);
      } catch (error) {
        console.error('Error handling foreground message:', error);
        AnalyticsService.logError(error, { 
          context: 'foreground_notification',
          messageData: JSON.stringify(remoteMessage)
        });
      }
    });
    
    // Handle background/quit messages that opened the app
    this.openedUnsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
      try {
        AnalyticsService.logEvent('notification_opened', {
          type: remoteMessage.data?.type || 'unknown',
          inBackground: true
        });
        
        // Handle navigation or other actions based on notification
        this.handleNotificationOpen(remoteMessage);
      } catch (error) {
        console.error('Error handling opened notification:', error);
        AnalyticsService.logError(error, { 
          context: 'notification_opened',
          messageData: JSON.stringify(remoteMessage)
        });
      }
    });
    
    // Check if app was opened from a notification
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        try {
          AnalyticsService.logEvent('app_opened_from_notification', {
            type: remoteMessage.data?.type || 'unknown'
          });
          
          // Handle navigation or other actions based on notification
          this.handleNotificationOpen(remoteMessage);
        } catch (error) {
          console.error('Error handling initial notification:', error);
          AnalyticsService.logError(error, { 
            context: 'initial_notification',
            messageData: JSON.stringify(remoteMessage)
          });
        }
      }
    });
    
    // Set up notifee foreground event handler
    this.notifeeUnsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      try {
        switch (type) {
          case EventType.PRESS:
            AnalyticsService.logEvent('foreground_notification_pressed', {
              notificationId: detail.notification?.id || 'unknown'
            });
            
            // Handle navigation or other actions
            this.handleNotificationPress(detail.notification);
            break;
            
          case EventType.ACTION_PRESS:
            AnalyticsService.logEvent('notification_action_pressed', {
              actionId: detail.pressAction?.id || 'unknown',
              notificationId: detail.notification?.id || 'unknown'
            });
            
            // Handle the specific action
            this.handleNotificationAction(detail.pressAction, detail.notification);
            break;
        }
      } catch (error) {
        console.error('Error in notifee foreground event:', error);
        AnalyticsService.logError(error, { 
          context: 'notifee_foreground_event',
          eventType: type,
          notificationId: detail.notification?.id
        });
      }
    });
    
    // Set up token refresh handler
    this.tokenRefreshUnsubscribe = messaging().onTokenRefresh((token) => {
      try {
        // Save the new token
        AsyncStorage.setItem('fcmToken', token);
        this.fcmToken = token;
        
        // Update the token in Firestore
        if (this.userId) {
          firestore().collection('users').doc(this.userId).update({
            fcmTokens: firestore.FieldValue.arrayUnion({
              token,
              device: Platform.OS,
              createdAt: firestore.FieldValue.serverTimestamp()
            })
          });
        }
        
        AnalyticsService.logEvent('fcm_token_refreshed', { success: true });
      } catch (error) {
        console.error('Error handling token refresh:', error);
        AnalyticsService.logError(error, { context: 'token_refresh' });
      }
    });
  }
  
  async displayNotification(remoteMessage) {
    try {
      // Find the appropriate channel for this notification
      const type = remoteMessage.data?.type || 'system';
      const channelId = this.channels[type]?.id || this.channels.system.id;
      
      // Create notification
      await notifee.displayNotification({
        title: remoteMessage.notification?.title || 'New Notification',
        body: remoteMessage.notification?.body || '',
        android: {
          channelId,
          smallIcon: 'ic_notification', // Make sure this icon exists in your project
          pressAction: {
            id: 'default',
          },
          // Add actions if needed
          actions: this.getNotificationActions(remoteMessage),
        },
        ios: {
          // iOS-specific configuration
          categoryId: type,
        },
        data: remoteMessage.data,
      });
      
      return true;
    } catch (error) {
      console.error('Error displaying notification:', error);
      AnalyticsService.logError(error, { 
        context: 'display_notification',
        messageData: JSON.stringify(remoteMessage)
      });
      return false;
    }
  }
  
  getNotificationActions(remoteMessage) {
    // Return dynamic actions based on notification type
    const type = remoteMessage.data?.type;
    
    switch (type) {
      case 'message':
        return [
          {
            title: 'Reply',
            pressAction: {
              id: 'reply',
            },
            input: {
              allowFreeFormInput: true,
              placeholder: 'Reply to this message...',
            },
          },
          {
            title: 'Mark as Read',
            pressAction: {
              id: 'mark_read',
            },
          },
        ];
      case 'event':
        return [
          {
            title: 'View Details',
            pressAction: {
              id: 'view_details',
            },
          },
          {
            title: 'RSVP',
            pressAction: {
              id: 'rsvp',
            },
          },
        ];
      default:
        return [];
    }
  }
  
  handleNotificationOpen(remoteMessage) {
    // Implement navigation or other actions based on notification type
    const type = remoteMessage.data?.type;
    const id = remoteMessage.data?.id;
    
    // This would typically use a navigation reference to navigate the user
    console.log(`Would navigate to ${type} with id ${id}`);
    
    // You would implement actual navigation based on your app structure
  }
  
  handleNotificationPress(notification) {
    // Similar to handleNotificationOpen but for notifee notifications
    const type = notification?.data?.type;
    const id = notification?.data?.id;
    
    console.log(`Notification pressed: ${type} with id ${id}`);
    
    // Implement navigation or other actions
  }
  
  handleNotificationAction(action, notification) {
    // Handle specific actions
    if (!action || !notification) return;
    
    const actionId = action.id;
    const type = notification.data?.type;
    const id = notification.data?.id;
    
    console.log(`Action ${actionId} for ${type} with id ${id}`);
    
    // Implement specific action handling based on actionId
    switch (actionId) {
      case 'reply':
        // Handle reply action
        break;
      case 'mark_read':
        // Mark message as read
        break;
      case 'view_details':
        // Navigate to details
        break;
      case 'rsvp':
        // Show RSVP options
        break;
    }
  }
  
  async cleanup() {
    try {
      // Remove all event listeners
      if (this.messageUnsubscribe) {
        this.messageUnsubscribe();
      }
      
      if (this.openedUnsubscribe) {
        this.openedUnsubscribe();
      }
      
      if (this.notifeeUnsubscribe) {
        this.notifeeUnsubscribe();
      }
      
      if (this.tokenRefreshUnsubscribe) {
        this.tokenRefreshUnsubscribe();
      }
      
      // Cancel any displayed notifications
      await notifee.cancelAllNotifications();
      
      // Reset state
      this.initialized = false;
      this.userId = null;
      
      AnalyticsService.logEvent('notification_service_cleanup', {
        success: true
      });
      
      return true;
    } catch (error) {
      console.error('Error cleaning up notification service:', error);
      AnalyticsService.logError(error, { context: 'notification_cleanup' });
      return false;
    }
  }
  
  // Method to send a local notification (for testing or local reminders)
  async sendLocalNotification(title, body, data = {}, channelType = 'system') {
    try {
      const channelId = this.channels[channelType]?.id || this.channels.system.id;
      
      await notifee.displayNotification({
        title,
        body,
        android: {
          channelId,
        },
        data,
      });
      
      return true;
    } catch (error) {
      console.error('Error sending local notification:', error);
      AnalyticsService.logError(error, { context: 'local_notification' });
      return false;
    }
  }
}

export default new NotificationService();

// src/hooks/useNotifications.js
// Custom hook for working with notifications

import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Platform } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useUser } from '../contexts/UserContext';
import messaging from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Custom hook for working with notifications
 * @returns {Object} Notification utilities and state
 */
export const useNotifications = () => {
  const dispatch = useDispatch();
  const { user, userData, blockedUsers } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [notificationListener, setNotificationListener] = useState(null);

  // Initialize notifications
  useEffect(() => {
    if (user) {
      // Check permission status
      checkPermissions();
      
      // Register device for notifications if permission is granted
      if (permissionStatus === 'granted') {
        registerDeviceForNotifications();
      }
      
      // Load notifications
      loadNotifications();
    }
    
    // Cleanup
    return () => {
      if (notificationListener) {
        notificationListener();
      }
    };
  }, [user, permissionStatus]);

  /**
   * Check notification permissions
   */
  const checkPermissions = async () => {
    try {
      const authStatus = await messaging().hasPermission();
      if (authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
          authStatus === messaging.AuthorizationStatus.PROVISIONAL) {
        setPermissionStatus('granted');
      } else if (authStatus === messaging.AuthorizationStatus.NOT_DETERMINED) {
        setPermissionStatus('undetermined');
      } else {
        setPermissionStatus('denied');
      }
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      setPermissionStatus('error');
    }
  };

  /**
   * Request notification permissions
   * @returns {Promise<boolean>} Whether permissions were granted
   */
  const requestPermissions = async () => {
    try {
      const authStatus = await messaging().requestPermission();
      const isGranted = authStatus === messaging.AuthorizationStatus.AUTHORIZED || 
                         authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      
      setPermissionStatus(isGranted ? 'granted' : 'denied');
      
      if (isGranted) {
        await registerDeviceForNotifications();
      }
      
      return isGranted;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      setPermissionStatus('error');
      return false;
    }
  };

  /**
   * Register device for notifications
   */
  const registerDeviceForNotifications = async () => {
    try {
      // Check if already registered
      const isRegistered = await messaging().isDeviceRegisteredForRemoteMessages;
      
      if (!isRegistered) {
        await messaging().registerDeviceForRemoteMessages();
      }
      
      // Get FCM token
      const token = await messaging().getToken();
      
      // Save token to user's document for sending push notifications
      if (user && token) {
        await firestore()
          .collection('users')
          .doc(user.uid)
          .update({
            fcmTokens: firestore.FieldValue.arrayUnion(token),
            lastTokenUpdate: firestore.FieldValue.serverTimestamp()
          });
        
        // Store token locally
        await AsyncStorage.setItem('fcmToken', token);
        
        // Set up notification listeners
        setupNotificationListeners();
      }
    } catch (error) {
      console.error('Error registering device for notifications:', error);
    }
  };

  /**
   * Set up notification listeners
   */
  const setupNotificationListeners = () => {
    // Initialize PushNotification
    PushNotification.configure({
      onNotification: function(notification) {
        // Handle notification
        handleNotification(notification);
        
        // Required on iOS only
        if (Platform.OS === 'ios') {
          notification.finish();
        }
      },
      
      // IOS ONLY
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      
      popInitialNotification: true,
      requestPermissions: false, // We handle permissions separately
    });
    
    // Register foreground handler
    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      // Create a local notification when app is in foreground
      displayLocalNotification(remoteMessage);
    });
    
    // Register background/quit handler
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      // Handle background message
      // For background messages, the system already shows the notification
    });
    
    // Check for initial notification (app opened from a notification)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          // Handle the notification that opened the app
          handleNotification(remoteMessage);
        }
      });
    
    // Set listener
    setNotificationListener(() => unsubscribeForeground);
  };

  /**
   * Handle notification when received or clicked
   * @param {Object} notification - Notification data
   */
  const handleNotification = (notification) => {
    // Update notifications list
    loadNotifications();
    
    // You could navigate to a specific screen here based on notification type
    // or implement other custom handling
  };

  /**
   * Display a local notification
   * @param {Object} notification - Notification data
   */
  const displayLocalNotification = (notification) => {
    const { notification: notificationData, data } = notification;
    
    if (!notificationData) return;
    
    const { title, body } = notificationData;
    
    PushNotification.localNotification({
      channelId: 'default', // Ensure you've created this channel
      title,
      message: body,
      userInfo: data,
      playSound: true,
      soundName: 'default',
    });
  };

  /**
   * Load notifications from Firestore
   */
  const loadNotifications = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get notifications
      const notificationsSnapshot = await firestore()
        .collection('notifications')
        .where('recipientId', '==', user.uid)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
      
      // Filter out notifications from blocked users
      let notificationsData = notificationsSnapshot.docs
        .filter(doc => !blockedUsers.includes(doc.data().senderId))
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
        }));
      
      setNotifications(notificationsData);
      setUnreadCount(notificationsData.filter(n => !n.read).length);
      setLastFetchedAt(new Date().toISOString());
      
      // Update badge count on iOS
      if (Platform.OS === 'ios') {
        PushNotification.setApplicationIconBadgeNumber(
          notificationsData.filter(n => !n.read).length
        );
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Refresh notifications list
   */
  const refreshNotifications = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
  }, [user]);

  /**
   * Mark a specific notification as read
   * @param {string} notificationId - Notification ID
   */
  const markAsRead = async (notificationId) => {
    if (!user) return;
    
    try {
      // Update in Firestore
      await firestore()
        .collection('notifications')
        .doc(notificationId)
        .update({
          read: true
        });
      
      // Update locally
      setNotifications(prev => 
        prev.map(notification => {
          if (notification.id === notificationId) {
            return { ...notification, read: true };
          }
          return notification;
        })
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Update badge count on iOS
      if (Platform.OS === 'ios') {
        PushNotification.setApplicationIconBadgeNumber(
          Math.max(0, unreadCount - 1)
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      // Get all unread notifications
      const unreadSnapshot = await firestore()
        .collection('notifications')
        .where('recipientId', '==', user.uid)
        .where('read', '==', false)
        .get();
      
      if (unreadSnapshot.empty) return;
      
      // Use a batch to update all at once
      const batch = firestore().batch();
      
      unreadSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
      });
      
      await batch.commit();
      
      // Update locally
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
      
      // Reset unread count
      setUnreadCount(0);
      
      // Update badge count on iOS
      if (Platform.OS === 'ios') {
        PushNotification.setApplicationIconBadgeNumber(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   */
  const deleteNotification = async (notificationId) => {
    if (!user) return;
    
    try {
      // Delete from Firestore
      await firestore()
        .collection('notifications')
        .doc(notificationId)
        .delete();
      
      // Update locally
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Update unread count if notification was unread
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Update badge count on iOS
        if (Platform.OS === 'ios') {
          PushNotification.setApplicationIconBadgeNumber(
            Math.max(0, unreadCount - 1)
          );
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  /**
   * Delete all notifications
   */
  const deleteAllNotifications = async () => {
    if (!user) return;
    
    try {
      // Get all user's notifications
      const notificationsSnapshot = await firestore()
        .collection('notifications')
        .where('recipientId', '==', user.uid)
        .get();
      
      if (notificationsSnapshot.empty) return;
      
      // Use a batch to delete all at once
      const batch = firestore().batch();
      
      notificationsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      // Update locally
      setNotifications([]);
      setUnreadCount(0);
      
      // Update badge count on iOS
      if (Platform.OS === 'ios') {
        PushNotification.setApplicationIconBadgeNumber(0);
      }
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
  };

  /**
   * Create a new notification
   * @param {Object} notificationData - Notification data
   */
  const createNotification = async (notificationData) => {
    try {
      // Add to Firestore
      const notificationRef = await firestore()
        .collection('notifications')
        .add({
          ...notificationData,
          timestamp: firestore.FieldValue.serverTimestamp(),
          read: false
        });
      
      return notificationRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    refreshing,
    permissionStatus,
    loadNotifications,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    createNotification,
    requestPermissions,
  };
};

export default useNotifications;

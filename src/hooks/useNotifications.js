// src/hooks/useNotifications.js
// Custom hook for handling notifications

import { useState, useEffect, useCallback, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { Platform, AppState } from 'react-native';
import { useUser } from '../contexts/UserContext';

export const useNotifications = () => {
  const { user } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('undetermined');
  
  const notificationsListener = useRef(null);
  const appState = useRef(AppState.currentState);
  
  // Initialize push notifications
  useEffect(() => {
    // Configure local notifications
    PushNotification.configure({
      // (required) Called when a remote is received or opened, or local notification is opened
      onNotification: function (notification) {
        // Process the notification
        if (Platform.OS === 'ios') {
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },
      
      // Should the initial notification be popped automatically
      popInitialNotification: true,
      
      // Request permissions for iOS
      requestPermissions: Platform.OS === 'ios',
      
      // Permissions for Android
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
    });
    
    // Create notification channel for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'health-connect-notifications',
          channelName: 'HealthConnect Notifications',
          channelDescription: 'Notifications from the HealthConnect app',
          importance: 4, // High importance
          vibrate: true,
        },
        (created) => console.log(`Notification channel created: ${created}`)
      );
    }
    
    // Check permission status
    const checkPermissions = async () => {
      try {
        if (Platform.OS === 'ios') {
          const permission = await PushNotificationIOS.requestPermissions();
          setPermissionStatus(permission.alert ? 'granted' : 'denied');
        } else {
          // For Android, we manually check since we're not using Firebase messaging directly
          setPermissionStatus('granted'); // Android defaults to granted unless changed in settings
        }
      } catch (error) {
        console.error('Error checking notification permissions:', error);
        setPermissionStatus('denied');
      }
    };
    
    checkPermissions();
    
    // Listen for app state changes to refresh notifications
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current === 'background' && nextAppState === 'active') {
        refreshNotifications();
      }
      appState.current = nextAppState;
    });
    
    return () => {
      subscription.remove();
      
      // Clean up notification listener
      if (notificationsListener.current) {
        notificationsListener.current();
      }
    };
  }, []);
  
  // Fetch notifications when user changes
  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      if (notificationsListener.current) {
        notificationsListener.current();
        notificationsListener.current = null;
      }
    }
    
    return () => {
      if (notificationsListener.current) {
        notificationsListener.current();
        notificationsListener.current = null;
      }
    };
  }, [user]);
  
  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Clear previous listener if exists
      if (notificationsListener.current) {
        notificationsListener.current();
        notificationsListener.current = null;
      }
      
      // Set up real-time listener for notifications
      notificationsListener.current = firestore()
        .collection('notifications')
        .where('recipientId', '==', user.uid)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot(snapshot => {
          // Process snapshot
          const notificationData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          }));
          
          // Update state
          setNotifications(notificationData);
          
          // Count unread notifications
          const unread = notificationData.filter(n => !n.read).length;
          setUnreadCount(unread);
          
          // Update badge count on iOS
          if (Platform.OS === 'ios') {
            PushNotificationIOS.setApplicationIconBadgeNumber(unread);
          }
          
          setLoading(false);
          setRefreshing(false);
        }, error => {
          console.error('Error in notifications listener:', error);
          setLoading(false);
          setRefreshing(false);
        });
      
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);
  
  // Manual refresh for pull-to-refresh
  const refreshNotifications = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);
  
  // Mark a notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!user) return;
    
    try {
      await firestore()
        .collection('notifications')
        .doc(notificationId)
        .update({
          read: true
        });
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Update badge count on iOS
      if (Platform.OS === 'ios') {
        PushNotificationIOS.setApplicationIconBadgeNumber(Math.max(0, unreadCount - 1));
      }
      
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }, [user, unreadCount]);
  
  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    
    try {
      // Get all unread notifications
      const unreadSnapshot = await firestore()
        .collection('notifications')
        .where('recipientId', '==', user.uid)
        .where('read', '==', false)
        .get();
      
      if (unreadSnapshot.empty) return true;
      
      // Create batch to update all at once
      const batch = firestore().batch();
      unreadSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
      });
      
      await batch.commit();
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      
      // Update unread count
      setUnreadCount(0);
      
      // Update badge count on iOS
      if (Platform.OS === 'ios') {
        PushNotificationIOS.setApplicationIconBadgeNumber(0);
      }
      
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }, [user]);
  
  // Delete a notification
  const deleteNotification = useCallback(async (notificationId) => {
    if (!user) return;
    
    try {
      await firestore()
        .collection('notifications')
        .doc(notificationId)
        .delete();
      
      // Update local state
      setNotifications(prev => 
        prev.filter(n => n.id !== notificationId)
      );
      
      // Update unread count if necessary
      const wasUnread = notifications.find(n => n.id === notificationId)?.read === false;
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Update badge count on iOS
        if (Platform.OS === 'ios') {
          PushNotificationIOS.setApplicationIconBadgeNumber(Math.max(0, unreadCount - 1));
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }, [user, notifications, unreadCount]);
  
  // Register device for push notifications
  const registerDevice = useCallback(async () => {
    if (!user) return;
    
    try {
      // Request permissions if needed
      if (permissionStatus === 'undetermined') {
        if (Platform.OS === 'ios') {
          const permission = await PushNotificationIOS.requestPermissions();
          if (!permission.alert) {
            setPermissionStatus('denied');
            return;
          }
          setPermissionStatus('granted');
        } else {
          setPermissionStatus('granted');
        }
      }
      
      if (permissionStatus !== 'granted') return;
      
      // Create a device ID that's stable across app reinstalls
      const deviceId = await PushNotification.getDeviceToken();
      
      // Save device ID to user's profile for targeting push notifications
      await firestore()
        .collection('users')
        .doc(user.uid)
        .update({
          deviceTokens: firestore.FieldValue.arrayUnion(deviceId)
        });
    } catch (error) {
      console.error('Error registering device:', error);
    }
  }, [user, permissionStatus]);
  
  return {
    notifications,
    unreadCount,
    loading,
    refreshing,
    permissionStatus,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    registerDevice
  };
};

export default useNotifications;
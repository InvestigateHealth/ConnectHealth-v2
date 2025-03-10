// src/hooks/useNotifications.js
// Updated hook for handling notifications using Notifee

import { useState, useEffect, useCallback, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import { Platform, AppState } from 'react-native';
import { useUser } from '../contexts/UserContext';
import notifee from '@notifee/react-native';
import notificationService from '../services/NotificationService';

/**
 * Custom hook for handling notifications
 * @returns {Object} Notification methods and state
 */
export const useNotifications = () => {
  const { user } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('undetermined');
  
  const notificationsListener = useRef(null);
  const appState = useRef(AppState.currentState);
  
  // Initialize notification service
  useEffect(() => {
    const initializeNotifications = async () => {
      if (user) {
        await notificationService.initialize(user.uid);
        
        // Check permission status
        const settings = await notifee.getNotificationSettings();
        setPermissionStatus(
          settings.authorizationStatus > 0 ? 'granted' : 'denied'
        );
        
        // Listen to app state changes to refresh notifications
        const subscription = AppState.addEventListener('change', nextAppState => {
          if (appState.current === 'background' && nextAppState === 'active') {
            refreshNotifications();
          }
          appState.current = nextAppState;
        });
        
        return () => {
          subscription.remove();
        };
      }
    };
    
    initializeNotifications();
    
    return () => {
      if (notificationsListener.current) {
        notificationsListener.current();
        notificationsListener.current = null;
      }
    };
  }, [user]);
  
  // Fetch notifications when user changes
  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Set up Firestore notification listener
      notificationService.setupFirestoreNotificationListener();
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
          
          // Update badge count
          notificationService.setBadgeCount(unread);
          
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
          read: true,
          readAt: firestore.FieldValue.serverTimestamp()
        });
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Update badge count
      notificationService.setBadgeCount(Math.max(0, unreadCount - 1));
      
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
      const timestamp = firestore.FieldValue.serverTimestamp();
      
      unreadSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { 
          read: true,
          readAt: timestamp 
        });
      });
      
      await batch.commit();
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true }))
      );
      
      // Update unread count
      setUnreadCount(0);
      
      // Update badge count
      notificationService.setBadgeCount(0);
      
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
        
        // Update badge count
        notificationService.setBadgeCount(Math.max(0, unreadCount - 1));
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }, [user, notifications, unreadCount]);
  
  // Request permission for notifications
  const requestPermission = useCallback(async () => {
    try {
      const granted = await notificationService.requestPermission();
      setPermissionStatus(granted ? 'granted' : 'denied');
      return granted;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }, []);
  
  // Register device for push notifications
  const registerDevice = useCallback(async () => {
    if (!user) return;
    
    try {
      // Request permissions if needed
      if (permissionStatus === 'undetermined') {
        const granted = await requestPermission();
        if (!granted) return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error registering device:', error);
      return false;
    }
  }, [user, permissionStatus, requestPermission]);
  
  // Display local notification
  const displayLocalNotification = useCallback(async (title, body, data = {}) => {
    if (permissionStatus !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return false;
    }
    
    try {
      await notificationService.displayNotification({
        title,
        body,
        data
      });
      
      return true;
    } catch (error) {
      console.error('Error displaying local notification:', error);
      return false;
    }
  }, [permissionStatus, requestPermission]);
  
  // Schedule a notification
  const scheduleNotification = useCallback(async (title, body, date, data = {}) => {
    if (permissionStatus !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return null;
    }
    
    try {
      const notificationId = await notificationService.scheduleNotification(
        {
          title,
          body,
          data
        },
        date
      );
      
      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }, [permissionStatus, requestPermission]);
  
  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (notificationsListener.current) {
        notificationsListener.current();
      }
    };
  }, []);
  
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
    requestPermission,
    registerDevice,
    displayLocalNotification,
    scheduleNotification
  };
};

export default useNotifications;
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

export default useNotifications;
// src/screens/NotificationsScreen.js
// Updated screen for displaying user notifications using the custom hook

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../theme/ThemeContext';
import { useNotifications } from '../hooks/useNotifications';

const NotificationsScreen = () => {
  const { theme } = useTheme();
  const { user } = useUser();
  const navigation = useNavigation();
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    permissionStatus,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  // Request notification permissions if needed
  useEffect(() => {
    if (permissionStatus === 'undetermined') {
      // We'll ask for permissions when the user interacts with notifications
    }
  }, [permissionStatus]);

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      return formatDistanceToNow(timestamp, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  };

  // Get the appropriate icon for notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return { name: 'heart', color: '#F44336' };
      case 'comment':
        return { name: 'chatbubble', color: '#2196F3' };
      case 'follow':
        return { name: 'person-add', color: '#4CAF50' };
      case 'message':
        return { name: 'mail', color: '#FF9800' };
      default:
        return { name: 'notifications', color: '#607D8B' };
    }
  };

  // Handle notification press
  const handleNotificationPress = async (notification) => {
    // Mark as read first
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Navigate based on notification type
    switch (notification.type) {
      case 'like':
      case 'comment':
        if (notification.postId) {
          navigation.navigate('FeedTab', {
            screen: 'Comments',
            params: { 
              postId: notification.postId,
              title: 'Comments'
            }
          });
        }
        break;
      case 'follow':
        if (notification.senderId) {
          navigation.navigate('UserProfile', { 
            userId: notification.senderId,
            title: notification.senderName || 'Profile'
          });
        }
        break;
      case 'message':
        if (notification.conversationId) {
          navigation.navigate('ChatTab', {
            screen: 'Chat',
            params: {
              conversationId: notification.conversationId,
              recipientId: notification.senderId,
              recipientName: notification.senderName
            }
          });
        }
        break;
      default:
        // Default action for unknown notification types
        break;
    }
  };

  // Handle swipe to delete
  const handleDelete = (notificationId) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteNotification(notificationId)
        }
      ]
    );
  };

  // Render notification item
  const renderNotificationItem = ({ item }) => {
    const icon = getNotificationIcon(item.type);
    
    return (
      <TouchableOpacity 
        style={[
          styles.notificationItem, 
          !item.read && styles.unreadNotification,
          { backgroundColor: theme.colors.background.card }
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
          <Icon name={icon.name} size={20} color={icon.color} />
        </View>
        
        <View style={styles.notificationContent}>
          {item.senderProfileImage ? (
            <FastImage
              style={styles.profileImage}
              source={{ uri: item.senderProfileImage }}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={[styles.profileImage, styles.placeholderProfile, { backgroundColor: theme.colors.gray[400] }]}>
              <Icon name="person" size={14} color="#FFF" />
            </View>
          )}
          
          <View style={styles.textContainer}>
            <Text style={[
              styles.notificationText,
              { color: theme.colors.text.primary }
            ]}>
              <Text style={[
                styles.senderName,
                { color: theme.colors.text.primary }
              ]}>{item.senderName || 'Someone'}</Text>
              {' '}
              {item.message || 'interacted with you'}
            </Text>
            <Text style={[
              styles.timestamp,
              { color: theme.colors.text.secondary }
            ]}>{formatTimestamp(item.timestamp)}</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
        >
          <Icon name="close-circle" size={18} color={theme.colors.text.hint} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Render empty notifications view
  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon 
        name="notifications-off-outline" 
        size={60} 
        color={theme.colors.gray[300]} 
      />
      <Text style={[
        styles.emptyTitle,
        { color: theme.colors.text.primary }
      ]}>No notifications yet</Text>
      <Text style={[
        styles.emptySubtext,
        { color: theme.colors.text.secondary }
      ]}>
        When you get notifications, they'll appear here
      </Text>
    </View>
  );

  // Render header with mark all as read button
  const renderHeader = () => {
    if (notifications.length === 0 || unreadCount === 0) return null;
    
    return (
      <View style={[styles.header, { backgroundColor: theme.colors.background.paper }]}>
        <TouchableOpacity
          style={[styles.markAllButton, { backgroundColor: theme.colors.primary.light }]}
          onPress={markAllAsRead}
        >
          <Icon name="checkmark-done" size={16} color={theme.colors.primary.dark} />
          <Text style={[styles.markAllText, { color: theme.colors.primary.dark }]}>
            Mark all as read
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.default }]}>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={
            notifications.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
          }
          ListEmptyComponent={renderEmptyComponent}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshNotifications}
              colors={[theme.colors.primary.main]}
              tintColor={theme.colors.primary.main}
            />
          }
        />
      )}
      
      {permissionStatus === 'denied' && (
        <View style={[styles.permissionBanner, { backgroundColor: theme.colors.warning.light }]}>
          <Icon name="notifications-off" size={20} color={theme.colors.warning.dark} />
          <Text style={[styles.permissionText, { color: theme.colors.warning.dark }]}>
            Notifications are disabled. Enable them in your device settings.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 12,
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  unreadNotification: {
    backgroundColor: '#E3F2FD',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  placeholderProfile: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    flexWrap: 'wrap',
  },
  senderName: {
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  permissionText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  }
});

export default NotificationsScreen;

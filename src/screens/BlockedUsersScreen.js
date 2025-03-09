// src/screens/BlockedUsersScreen.js
// Improved screen for managing blocked users

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Animated
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../theme/ThemeContext';
import { BlockService } from '../services/FirebaseService';
import { useNetInfo } from '@react-native-community/netinfo';
import { format } from 'date-fns';

const BlockedUsersScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user, unblockUser, blockedUsers } = useUser();
  const { isConnected } = useNetInfo();
  
  const [blockedUserDetails, setBlockedUserDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState([]);
  const [error, setError] = useState(null);
  
  // Animation value for item removal
  const itemAnimatedValues = {};
  blockedUserDetails.forEach(item => {
    if (!itemAnimatedValues[item.id]) {
      itemAnimatedValues[item.id] = new Animated.Value(1);
    }
  });

  // Fetch blocked user details on component mount
  useEffect(() => {
    fetchBlockedUserDetails();
  }, [user, blockedUsers]);

  // Function to fetch blocked user details
  const fetchBlockedUserDetails = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      if (!isConnected) {
        setError('Cannot load blocked users while offline');
        setLoading(false);
        return;
      }
      
      const details = await BlockService.getBlockedUserDetails(user.uid);
      
      // Sort by most recently blocked
      details.sort((a, b) => {
        if (a.blockInfo?.timestamp && b.blockInfo?.timestamp) {
          return b.blockInfo.timestamp - a.blockInfo.timestamp;
        }
        return 0;
      });
      
      setBlockedUserDetails(details);
    } catch (error) {
      console.error('Error fetching blocked user details:', error);
      setError('Failed to load blocked users. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Function to handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBlockedUserDetails();
  }, []);

  // Function to animate item removal
  const animateItemRemoval = (id, callback) => {
    Animated.timing(itemAnimatedValues[id], {
      toValue: 0,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      if (callback) callback();
    });
  };

  // Function to handle unblock
  const handleUnblock = useCallback((blockedUserId, userName) => {
    if (!isConnected) {
      Alert.alert('Offline', 'You cannot unblock users while offline.');
      return;
    }
    
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unblock',
          onPress: async () => {
            try {
              // Add to processing state to show loading indicator
              setProcessingIds(prev => [...prev, blockedUserId]);
              
              const success = await unblockUser(blockedUserId);
              
              if (success) {
                // Animate removal
                animateItemRemoval(blockedUserId, () => {
                  // Remove from local state after animation completes
                  setBlockedUserDetails(prev => 
                    prev.filter(user => user.id !== blockedUserId)
                  );
                });
              } else {
                throw new Error('Failed to unblock user');
              }
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Failed to unblock user. Please try again.');
            } finally {
              // Remove from processing state
              setProcessingIds(prev => prev.filter(id => id !== blockedUserId));
            }
          } 
        }
      ]
    );
  }, [isConnected, unblockUser]);

  // Function to handle viewing a user's profile
  const handleViewProfile = useCallback((userId) => {
    navigation.navigate('UserProfile', { userId });
  }, [navigation]);

  // Function to format block timestamp
  const formatBlockDate = useCallback((timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    try {
      return format(new Date(timestamp), 'MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  }, []);

  // Render blocked user item
  const renderBlockedUser = useCallback(({ item }) => {
    // Check if this item is being processed
    const isProcessing = processingIds.includes(item.id);
    const userName = `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unknown User';
    
    return (
      <Animated.View style={{
        opacity: itemAnimatedValues[item.id],
        transform: [{
          translateX: itemAnimatedValues[item.id].interpolate({
            inputRange: [0, 1],
            outputRange: [-100, 0]
          })
        }]
      }}>
        <View style={[
          styles.userItem, 
          { backgroundColor: theme.colors.background.card }
        ]}>
          <TouchableOpacity 
            style={styles.userInfo} 
            onPress={() => handleViewProfile(item.id)}
            disabled={isProcessing}
          >
            {item.profileImageURL ? (
              <FastImage
                source={{ uri: item.profileImageURL }}
                style={styles.avatar}
                defaultSource={require('../assets/default-avatar.png')}
              />
            ) : (
              <View style={[
                styles.avatar, 
                styles.defaultAvatar, 
                { backgroundColor: theme.colors.gray[400] }
              ]}>
                <Icon name="person" size={20} color="#FFF" />
              </View>
            )}
            
            <View style={styles.userDetails}>
              <Text style={[
                styles.userName, 
                { color: theme.colors.text.primary }
              ]}>
                {userName}
              </Text>
              
              {item.blockInfo?.reason && (
                <Text style={[
                  styles.blockReason, 
                  { color: theme.colors.text.secondary }
                ]}>
                  Reason: {item.blockInfo.reason}
                </Text>
              )}
              
              {item.blockInfo?.timestamp && (
                <Text style={[
                  styles.blockDate, 
                  { color: theme.colors.text.hint }
                ]}>
                  Blocked on {formatBlockDate(item.blockInfo.timestamp)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.unblockButton, 
              { backgroundColor: theme.colors.error.light },
              isProcessing && styles.disabledButton
            ]}
            onPress={() => handleUnblock(item.id, userName)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={theme.colors.error.dark} />
            ) : (
              <Text style={[
                styles.unblockText, 
                { color: theme.colors.error.dark }
              ]}>
                Unblock
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }, [theme, processingIds, handleUnblock, handleViewProfile, formatBlockDate]);

  // Render empty list message
  const renderEmptyList = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Icon 
        name="shield-checkmark-outline" 
        size={64} 
        color={theme.colors.gray[300]} 
      />
      <Text style={[
        styles.emptyTitle, 
        { color: theme.colors.text.primary }
      ]}>
        No Blocked Users
      </Text>
      <Text style={[
        styles.emptyText, 
        { color: theme.colors.text.secondary }
      ]}>
        You haven't blocked any users yet
      </Text>
    </View>
  ), [theme]);

  // Render error message
  const renderErrorMessage = useCallback(() => (
    <View style={styles.errorContainer}>
      <Icon 
        name="alert-circle-outline" 
        size={64} 
        color={theme.colors.error.main} 
      />
      <Text style={[
        styles.errorTitle, 
        { color: theme.colors.error.main }
      ]}>
        Error
      </Text>
      <Text style={[
        styles.errorText, 
        { color: theme.colors.text.secondary }
      ]}>
        {error}
      </Text>
      <TouchableOpacity 
        style={[
          styles.retryButton, 
          { backgroundColor: theme.colors.primary.main }
        ]}
        onPress={fetchBlockedUserDetails}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  ), [error, theme, fetchBlockedUserDetails]);

  return (
    <View style={[
      styles.container, 
      { backgroundColor: theme.colors.background.default }
    ]}>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={[
            styles.loadingText, 
            { color: theme.colors.text.secondary }
          ]}>
            Loading blocked users...
          </Text>
        </View>
      ) : error ? (
        renderErrorMessage()
      ) : (
        <>
          <View style={[
            styles.header, 
            { 
              backgroundColor: theme.colors.background.paper,
              borderBottomColor: theme.colors.divider
            }
          ]}>
            <Text style={[
              styles.headerTitle, 
              { color: theme.colors.text.primary }
            ]}>
              Blocked Users ({blockedUserDetails.length})
            </Text>
            <Text style={[
              styles.headerSubtitle, 
              { color: theme.colors.text.secondary }
            ]}>
              Blocked users cannot interact with you
            </Text>
          </View>
          
          {!isConnected && (
            <View style={[
              styles.offlineWarning, 
              { backgroundColor: theme.colors.warning.light }
            ]}>
              <Icon 
                name="cloud-offline-outline" 
                size={18} 
                color={theme.colors.warning.dark} 
              />
              <Text style={[
                styles.offlineWarningText, 
                { color: theme.colors.warning.dark }
              ]}>
                You're offline. Some actions may be unavailable.
              </Text>
            </View>
          )}
          
          <FlatList
            data={blockedUserDetails}
            renderItem={renderBlockedUser}
            keyExtractor={(item) => item.id}
            contentContainerStyle={
              blockedUserDetails.length === 0 ? { flex: 1 } : { paddingBottom: 16 }
            }
            ListEmptyComponent={renderEmptyList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.colors.primary.main]}
                tintColor={theme.colors.primary.main}
              />
            }
          />
        </>
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  defaultAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  blockReason: {
    fontSize: 14,
    marginBottom: 4,
  },
  blockDate: {
    fontSize: 12,
  },
  unblockButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  offlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  offlineWarningText: {
    fontSize: 14,
    marginLeft: 8,
  }
});

export default BlockedUsersScreen;

// src/screens/BlockedUsersScreen.js
// Screen for managing blocked users

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../theme/ThemeContext';
import { BlockService } from '../services/FirebaseService';

const BlockedUsersScreen = () => {
  const { theme } = useTheme();
  const { user, unblockUser } = useUser();
  const [blockedUserDetails, setBlockedUserDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockedUserDetails();
  }, []);

  const fetchBlockedUserDetails = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const details = await BlockService.getBlockedUserDetails(user.uid);
      setBlockedUserDetails(details);
    } catch (error) {
      console.error('Error fetching blocked user details:', error);
      Alert.alert('Error', 'Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = (blockedUserId) => {
    Alert.alert(
      'Unblock User',
      'Are you sure you want to unblock this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unblock',
          onPress: async () => {
            try {
              const success = await unblockUser(blockedUserId);
              if (success) {
                // Remove from local state for immediate UI update
                setBlockedUserDetails(prev => 
                  prev.filter(user => user.id !== blockedUserId)
                );
              }
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Failed to unblock user');
            }
          } 
        }
      ]
    );
  };

  const renderBlockedUser = ({ item }) => (
    <View style={[styles.userItem, { backgroundColor: theme.colors.background.card }]}>
      <View style={styles.userInfo}>
        {item.profileImageURL ? (
          <FastImage
            source={{ uri: item.profileImageURL }}
            style={styles.avatar}
            defaultSource={require('../assets/default-avatar.png')}
          />
        ) : (
          <View style={[styles.avatar, styles.defaultAvatar, { backgroundColor: theme.colors.gray[400] }]}>
            <Icon name="person" size={20} color="#FFF" />
          </View>
        )}
        
        <View style={styles.userDetails}>
          <Text style={[styles.userName, { color: theme.colors.text.primary }]}>
            {item.firstName} {item.lastName}
          </Text>
          
          {item.blockInfo?.reason && (
            <Text style={[styles.blockReason, { color: theme.colors.text.secondary }]}>
              Reason: {item.blockInfo.reason}
            </Text>
          )}
          
          {item.blockInfo?.timestamp && (
            <Text style={[styles.blockDate, { color: theme.colors.text.hint }]}>
              Blocked on {new Date(item.blockInfo.timestamp).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
      
      <TouchableOpacity
        style={[styles.unblockButton, { backgroundColor: theme.colors.error.light }]}
        onPress={() => handleUnblock(item.id)}
      >
        <Text style={[styles.unblockText, { color: theme.colors.error.dark }]}>Unblock</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Icon name="shield-checkmark-outline" size={64} color={theme.colors.gray[300]} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
        No Blocked Users
      </Text>
      <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
        You haven't blocked any users yet
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.default }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      ) : (
        <>
          <View style={[styles.header, { backgroundColor: theme.colors.background.paper }]}>
            <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
              Blocked Users ({blockedUserDetails.length})
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.colors.text.secondary }]}>
              Blocked users cannot interact with you
            </Text>
          </View>
          
          <FlatList
            data={blockedUserDetails}
            renderItem={renderBlockedUser}
            keyExtractor={(item) => item.id}
            contentContainerStyle={
              blockedUserDetails.length === 0 ? { flex: 1 } : { paddingBottom: 16 }
            }
            ListEmptyComponent={renderEmptyList}
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
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
    marginBottom: 2,
  },
  blockReason: {
    fontSize: 14,
    marginBottom: 2,
  },
  blockDate: {
    fontSize: 12,
  },
  unblockButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '500',
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
});

export default BlockedUsersScreen;

// src/screens/UserProfileScreen.js
// Complete production-ready profile screen for viewing other users

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Share,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  Keyboard,
  AccessibilityInfo
} from 'react-native';
import FastImage from 'react-native-fast-image';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../theme/ThemeContext';
import { useNetInfo } from '@react-native-community/netinfo';
import PostThumbnail from '../components/PostThumbnail';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '../utils/haptics';
import { AnalyticsService } from '../services/AnalyticsService';

const UserProfileScreen = ({ route, navigation }) => {
  const { userId } = route.params;
  const { theme } = useTheme();
  const { user, userData: currentUserData, isUserBlocked, blockUser, unblockUser } = useUser();
  const { isConnected } = useNetInfo();
  const insets = useSafeAreaInsets();
  
  const [userData, setUserData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' or 'about'
  const [stats, setStats] = useState({
    followersCount: 0,
    followingCount: 0,
    postsCount: 0
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [userIsBlocked, setUserIsBlocked] = useState(false);
  const [error, setError] = useState(null);
  const [customBlockReason, setCustomBlockReason] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  const isMounted = useRef(true);
  const postsListener = useRef(null);
  const connectionListener = useRef(null);
  const flatListRef = useRef();

  // Set isMounted flag for preventing state updates after unmount
  useEffect(() => {
    // Log screen view for analytics
    AnalyticsService.logScreenView('UserProfile', { userId });
    
    return () => {
      isMounted.current = false;
      if (postsListener.current) {
        postsListener.current();
      }
      if (connectionListener.current) {
        connectionListener.current();
      }
    };
  }, []);

  // Check if the user is blocked
  useEffect(() => {
    if (userId) {
      setUserIsBlocked(isUserBlocked(userId));
    }
  }, [userId, isUserBlocked]);

  // Fetch user data and stats
  useEffect(() => {
    fetchUserData();
    fetchUserStats();
    checkFollowStatus();
  }, [userId]);

  // Fetch user posts
  useEffect(() => {
    if (activeTab === 'posts' && !userIsBlocked) {
      fetchUserPosts();
    } else {
      setPostsLoading(false);
    }

    return () => {
      if (postsListener.current) {
        postsListener.current();
        postsListener.current = null;
      }
    };
  }, [userId, activeTab, userIsBlocked]);

  // Update navigation title when user data is loaded
  useEffect(() => {
    if (userData) {
      const displayName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      navigation.setOptions({ title: displayName || 'Profile' });
    }
  }, [userData, navigation]);

  // Fetch user data
  const fetchUserData = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      
      // Try to get from cache first
      const cachedData = await getCachedUserData();
      if (cachedData && isMounted.current) {
        setUserData(cachedData);
        setLoading(false);
      }
      
      // Fetch from Firestore
      const userDoc = await firestore()
        .collection('users')
        .doc(userId)
        .get();
      
      if (userDoc.exists && isMounted.current) {
        const data = userDoc.data();
        const userData = {
          id: userDoc.id,
          ...data,
          joinDate: data.joinDate ? data.joinDate.toDate() : new Date()
        };
        
        // Update state with fresh data
        setUserData(userData);
        
        // Cache the user data
        cacheUserData(userData);
      } else if (isMounted.current) {
        setError('User not found. This profile may have been deleted.');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (isMounted.current) {
        setError('Failed to load user profile. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Cache user data for offline access
  const cacheUserData = async (data) => {
    try {
      await AsyncStorage.setItem(
        `user_profile_${userId}`,
        JSON.stringify({
          data,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      console.error('Error caching user data:', error);
    }
  };

  // Get cached user data
  const getCachedUserData = async () => {
    try {
      const cachedData = await AsyncStorage.getItem(`user_profile_${userId}`);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        
        // Check if cache is less than 1 hour old
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          return data;
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting cached user data:', error);
      return null;
    }
  };

  // Fetch user posts
  const fetchUserPosts = async () => {
    if (!userId || userIsBlocked) return;
    
    try {
      setPostsLoading(true);
      
      // Clean up existing listener if any
      if (postsListener.current) {
        postsListener.current();
        postsListener.current = null;
      }
      
      // Create a new realtime listener
      postsListener.current = firestore()
        .collection('posts')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(20)
        .onSnapshot(snapshot => {
          if (isMounted.current) {
            const postsData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
              };
            });
            
            setPosts(postsData);
            setPostsLoading(false);

            // Update post count
            setStats(prev => ({
              ...prev,
              postsCount: postsData.length
            }));
          }
        }, error => {
          console.error('Error in posts listener:', error);
          if (isMounted.current) {
            setPostsLoading(false);
          }
        });
    } catch (error) {
      console.error('Error setting up posts listener:', error);
      if (isMounted.current) {
        setPostsLoading(false);
      }
    }
  };

  // Fetch user stats (followers, following)
  const fetchUserStats = async () => {
    if (!userId) return;
    
    try {
      // Fetch followers count
      const followersSnapshot = await firestore()
        .collection('connections')
        .where('connectedUserId', '==', userId)
        .get();

      // Fetch following count
      const followingSnapshot = await firestore()
        .collection('connections')
        .where('userId', '==', userId)
        .get();

      if (isMounted.current) {
        setStats(prev => ({
          ...prev,
          followersCount: followersSnapshot.size,
          followingCount: followingSnapshot.size
        }));
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  // Check if the current user is following this user
  const checkFollowStatus = async () => {
    if (!userId || !user) return;
    
    try {
      const connectionDoc = await firestore()
        .collection('connections')
        .where('userId', '==', user.uid)
        .where('connectedUserId', '==', userId)
        .limit(1)
        .get();
      
      if (isMounted.current) {
        setIsFollowing(!connectionDoc.empty);
      }
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  // Toggle follow status
  const toggleFollow = async () => {
    if (!userId || !user || followLoading || !isConnected) {
      if (!isConnected) {
        Alert.alert('Offline', 'You cannot follow/unfollow users while offline.');
      }
      return;
    }
    
    try {
      setFollowLoading(true);
      Haptics.impactMedium();
      
      if (isFollowing) {
        // Unfollow the user
        const connectionQuery = await firestore()
          .collection('connections')
          .where('userId', '==', user.uid)
          .where('connectedUserId', '==', userId)
          .limit(1)
          .get();
        
        if (!connectionQuery.empty) {
          await connectionQuery.docs[0].ref.delete();
          
          // Remove notification
          await firestore()
            .collection('notifications')
            .where('type', '==', 'follow')
            .where('senderId', '==', user.uid)
            .where('recipientId', '==', userId)
            .get()
            .then(snapshot => {
              snapshot.forEach(doc => {
                doc.ref.delete();
              });
            });
          
          if (isMounted.current) {
            setIsFollowing(false);
            setStats(prev => ({
              ...prev,
              followersCount: Math.max(0, prev.followersCount - 1)
            }));
          }
          
          // Log analytics event
          AnalyticsService.logEvent('unfollow_user', { 
            userId: userId,
            currentUserId: user.uid
          });
        }
      } else {
        // Follow the user
        await firestore().collection('connections').add({
          userId: user.uid,
          connectedUserId: userId,
          timestamp: firestore.FieldValue.serverTimestamp()
        });
        
        // Create follow notification
        await firestore().collection('notifications').add({
          type: 'follow',
          senderId: user.uid,
          senderName: `${currentUserData.firstName} ${currentUserData.lastName}`.trim(),
          senderProfileImage: currentUserData.profileImageURL || null,
          recipientId: userId,
          message: 'started following you',
          timestamp: firestore.FieldValue.serverTimestamp(),
          read: false
        });
        
        if (isMounted.current) {
          setIsFollowing(true);
          setStats(prev => ({
            ...prev,
            followersCount: prev.followersCount + 1
          }));
        }
        
        // Log analytics event
        AnalyticsService.logEvent('follow_user', { 
          userId: userId,
          currentUserId: user.uid
        });
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
      Alert.alert('Error', `Failed to ${isFollowing ? 'unfollow' : 'follow'} user. Please try again.`);
    } finally {
      if (isMounted.current) {
        setFollowLoading(false);
      }
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    if (!isConnected) {
      Alert.alert('Offline', 'Cannot refresh while offline.');
      return;
    }
    
    setRefreshing(true);
    fetchUserData();
    fetchUserStats();
    checkFollowStatus();
  };

  // Share user profile
  const handleShareProfile = async () => {
    if (!userData) return;
    
    try {
      Haptics.impactLight();
      
      // Generate a dynamic link or a deep link to the user's profile
      const profileUrl = `healthconnect://user/${userId}`;
      const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      
      const result = await Share.share({
        message: `Connect with ${userName} on HealthConnect: ${profileUrl}`,
        url: Platform.OS === 'ios' ? profileUrl : undefined,
        title: 'Connect on HealthConnect'
      });
      
      if (result.action === Share.sharedAction) {
        // Log analytics event
        AnalyticsService.logEvent('share_profile', { 
          userId: userId,
          currentUserId: user.uid
        });
      }
    } catch (error) {
      console.error('Error sharing profile:', error);
      Alert.alert('Error', 'Failed to share profile. Please try again.');
    }
  };

  // Handle block/unblock
  const handleBlockToggle = useCallback(() => {
    if (!isConnected) {
      Alert.alert('Offline', 'You cannot block/unblock users while offline.');
      return;
    }
    
    if (userIsBlocked) {
      // Confirm unblock
      const userName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'this user';
      
      Alert.alert(
        'Unblock User',
        `Are you sure you want to unblock ${userName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Unblock', 
            onPress: async () => {
              try {
                const success = await unblockUser(userId);
                if (success) {
                  setUserIsBlocked(false);
                  Alert.alert('Success', `${userName} has been unblocked.`);
                  // Refresh posts after unblocking
                  fetchUserPosts();
                  
                  // Log analytics event
                  AnalyticsService.logEvent('unblock_user', { 
                    userId: userId,
                    currentUserId: user.uid
                  });
                } else {
                  throw new Error('Failed to unblock user');
                }
              } catch (error) {
                console.error('Error unblocking user:', error);
                Alert.alert('Error', 'Failed to unblock user. Please try again.');
              }
            }
          }
        ]
      );
    } else {
      // Show block modal
      setBlockModalVisible(true);
    }
  }, [userIsBlocked, userData, userId, unblockUser, isConnected]);

  // Submit block with reason
  const handleSubmitBlock = async () => {
    try {
      const finalReason = blockReason === 'Other' && customBlockReason 
        ? customBlockReason 
        : blockReason;
      
      const success = await blockUser(userId, finalReason);
      
      if (success) {
        setUserIsBlocked(true);
        setBlockModalVisible(false);
        
        const userName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'User';
        
        Alert.alert(
          'User Blocked',
          `You have blocked ${userName}. They will no longer be able to interact with you.`
        );
        
        // If the user was following, unfollow automatically
        if (isFollowing) {
          firestore()
            .collection('connections')
            .where('userId', '==', user.uid)
            .where('connectedUserId', '==', userId)
            .get()
            .then(snapshot => {
              snapshot.forEach(doc => {
                doc.ref.delete();
              });
              setIsFollowing(false);
            });
        }
        
        // Clear posts when blocked
        setPosts([]);
        
        // Log analytics event
        AnalyticsService.logEvent('block_user', { 
          userId: userId,
          currentUserId: user.uid,
          reason: finalReason
        });
      } else {
        throw new Error('Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      Alert.alert('Error', 'Failed to block user. Please try again.');
    }
  };

  // Handle report user
  const handleReportUser = useCallback(() => {
    if (!isConnected) {
      Alert.alert('Offline', 'You cannot report users while offline.');
      return;
    }
    
    setReportModalVisible(true);
  }, [isConnected]);

  // Submit report with reason
  const submitReport = async (reason) => {
    try {
      // Add report to database
      await firestore().collection('reports').add({
        type: 'user',
        contentId: userId,
        reportedUserId: userId,
        reportedBy: auth().currentUser.uid,
        reason: reason,
        additionalInfo: '', // Optional field for more details
        timestamp: firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        reviewed: false
      });
      
      setReportModalVisible(false);
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. We will review this user.'
      );
      
      // Log analytics event
      AnalyticsService.logEvent('report_user', { 
        userId: userId,
        currentUserId: user.uid,
        reason: reason
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };
  
  // Format join date
  const formatJoinDate = () => {
    try {
      if (!userData?.joinDate) return 'Recently';
      
      return format(userData.joinDate, 'MMMM yyyy');
    } catch (error) {
      console.error('Error formatting join date:', error);
      return 'Recently';
    }
  };
  
  // Render post item
  const renderPostItem = useCallback(({ item, index }) => (
    <PostThumbnail 
      post={item} 
      onPress={() => navigation.navigate('PostDetail', { 
        postId: item.id,
        title: 'Post Details'
      })}
      testID={`post-thumbnail-${index}`}
      accessibilityLabel={`Post from ${item.userFullName}, posted on ${format(item.timestamp, 'MMMM d, yyyy')}`}
    />
  ), [navigation]);
  
  // Handle tab change with haptic feedback
  const handleTabChange = (tab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      Haptics.selectionLight();
    }
  };
  
  // Navigate to followers list
  const navigateToFollowers = () => {
    if (stats.followersCount > 0) {
      navigation.navigate('UserFollowers', { 
        userId: userId,
        title: `${displayName}'s Followers`
      });
    }
  };
  
  // Navigate to following list
  const navigateToFollowing = () => {
    if (stats.followingCount > 0) {
      navigation.navigate('UserFollowing', { 
        userId: userId,
        title: `${displayName}'s Following`
      });
    }
  };
  
  // Get display name
  const displayName = userData 
    ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() 
    : 'User';
  
  // Rendering loading indicator
  if (loading) {
    return (
      <View 
        style={[styles.loadingContainer, { backgroundColor: theme.colors.background.default }]}
        accessibilityLabel="Loading profile"
      >
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
          Loading profile...
        </Text>
      </View>
    );
  }
  
  // Rendering error state
  if (error) {
    return (
      <View 
        style={[styles.errorContainer, { backgroundColor: theme.colors.background.default }]}
        accessibilityLabel="Error loading profile"
      >
        <Icon name="alert-circle-outline" size={64} color={theme.colors.error.main} />
        <Text style={[styles.errorTitle, { color: theme.colors.text.primary }]}>
          Error
        </Text>
        <Text style={[styles.errorMessage, { color: theme.colors.text.secondary }]}>
          {error}
        </Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: theme.colors.primary.main }]}
          onPress={fetchUserData}
          accessibilityLabel="Retry loading profile"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: theme.colors.background.default,
          paddingTop: insets.top,
          paddingBottom: insets.bottom
        }
      ]}
      accessibilityLabel={`Profile of ${displayName}`}
    >
      <ScrollView
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
      >
        {/* User info header */}
        <View 
          style={[styles.header, { backgroundColor: theme.colors.background.paper }]}
          accessibilityRole="header"
        >
          <View style={styles.profileImageContainer}>
            {userData?.profileImageURL ? (
              <FastImage
                style={styles.profileImage}
                source={{ uri: userData.profileImageURL }}
                resizeMode={FastImage.resizeMode.cover}
                defaultSource={require('../assets/default-avatar.png')}
                accessible={true}
                accessibilityLabel={`Profile picture of ${displayName}`}
              />
            ) : (
              <View 
                style={[
                  styles.profileImage, 
                  styles.placeholderProfile,
                  { backgroundColor: theme.colors.gray[400] }
                ]}
                accessible={true}
                accessibilityLabel="Default profile picture"
              >
                <Icon name="person" size={40} color="#FFF" />
              </View>
            )}
          </View>
          
          <Text 
            style={[styles.userName, { color: theme.colors.text.primary }]}
            accessibilityRole="header"
          >
            {displayName}
          </Text>
          
          {userData?.bio && !userIsBlocked && (
            <Text 
              style={[styles.bio, { color: theme.colors.text.secondary }]}
              accessibilityLabel={`Bio: ${userData.bio}`}
            >
              {userData.bio}
            </Text>
          )}
          
          {userIsBlocked && (
            <View 
              style={[styles.blockedBanner, { backgroundColor: theme.colors.error.light }]}
              accessibilityLabel="You have blocked this user"
            >
              <Icon name="ban" size={20} color={theme.colors.error.main} />
              <Text style={[styles.blockedText, { color: theme.colors.error.main }]}>
                You have blocked this user
              </Text>
            </View>
          )}
          
          {/* Stats section */}
          <View 
            style={[
              styles.statsContainer,
              { borderColor: theme.colors.divider }
            ]}
            accessibilityLabel="Profile statistics"
          >
            <View style={styles.statItem}>
              <Text 
                style={[styles.statNumber, { color: theme.colors.text.primary }]}
                accessibilityLabel={`${stats.postsCount} posts`}
              >
                {stats.postsCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
                Posts
              </Text>
            </View>
            
            <View style={[styles.statDivider, { backgroundColor: theme.colors.divider }]} />
            
            <TouchableOpacity 
              style={styles.statItem}
              onPress={navigateToFollowers}
              disabled={stats.followersCount === 0}
              accessibilityLabel={`${stats.followersCount} followers. ${stats.followersCount > 0 ? 'Double tap to view' : ''}`}
              accessibilityRole={stats.followersCount > 0 ? "button" : "none"}
              accessibilityHint={stats.followersCount > 0 ? "View list of followers" : ""}
            >
              <Text style={[styles.statNumber, { color: theme.colors.text.primary }]}>
                {stats.followersCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
                Followers
              </Text>
            </TouchableOpacity>
            
            <View style={[styles.statDivider, { backgroundColor: theme.colors.divider }]} />
            
            <TouchableOpacity 
              style={styles.statItem}
              onPress={navigateToFollowing}
              disabled={stats.followingCount === 0}
              accessibilityLabel={`${stats.followingCount} following. ${stats.followingCount > 0 ? 'Double tap to view' : ''}`}
              accessibilityRole={stats.followingCount > 0 ? "button" : "none"}
              accessibilityHint={stats.followingCount > 0 ? "View list of accounts followed" : ""}
            >
              <Text style={[styles.statNumber, { color: theme.colors.text.primary }]}>
                {stats.followingCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
                Following
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={[
                styles.actionButton,
                styles.followButton,
                isFollowing && [
                  styles.followingButton,
                  { borderColor: theme.colors.primary.main }
                ],
                { 
                  backgroundColor: isFollowing 
                    ? theme.colors.background.paper 
                    : theme.colors.primary.main
                }
              ]}
              onPress={toggleFollow}
              disabled={followLoading || userIsBlocked}
              accessibilityLabel={isFollowing ? "Unfollow" : "Follow"}
              accessibilityRole="button"
              accessibilityState={{ disabled: followLoading || userIsBlocked }}
            >
              {followLoading ? (
                <ActivityIndicator 
                  size="small" 
                  color={isFollowing ? theme.colors.primary.main : 'white'} 
                />
              ) : (
                <Text 
                  style={[
                    styles.actionButtonText,
                    styles.followButtonText,
                    { color: isFollowing ? theme.colors.primary.main : 'white' }
                  ]}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.background.paper }
              ]}
              onPress={handleShareProfile}
              accessibilityLabel="Share Profile"
              accessibilityRole="button"
            >
              <Text style={[
                styles.actionButtonText,
                { color: theme.colors.text.primary }
              ]}>
                Share
              </Text>
            </TouchableOpacity>
            
            {/* More Options Button */}
            <TouchableOpacity 
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.background.paper }
              ]}
              onPress={() => {
                Haptics.selectionLight();
                Alert.alert(
                  'More Options',
                  null,
                  [
                    { 
                      text: userIsBlocked ? 'Unblock User' : 'Block User', 
                      onPress: handleBlockToggle,
                      style: userIsBlocked ? 'default' : 'destructive'
                    },
                    { 
                      text: 'Report User', 
                      onPress: handleReportUser,
                      style: 'destructive'
                    },
                    { text: 'Cancel', style: 'cancel' }
                  ]
                );
              }}
              accessibilityLabel="More options"
              accessibilityRole="button"
              accessibilityHint="Open menu with additional actions like block and report"
            >
              <Text style={[
                styles.actionButtonText,
                { color: theme.colors.text.primary }
              ]}>
                More
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Medical conditions */}
          {userData?.medicalConditions && userData.medicalConditions.length > 0 && !userIsBlocked && (
            <View 
              style={styles.conditionsContainer}
              accessibilityLabel="Medical conditions"
            >
              <Text style={[
                styles.conditionsTitle,
                { color: theme.colors.text.primary }
              ]}>
                Medical Conditions
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.conditionsList}
                accessibilityLabel={`Medical conditions: ${userData.medicalConditions.join(', ')}`}
              >
                {userData.medicalConditions.map((condition, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.conditionTag,
                      { backgroundColor: theme.colors.primary.lightest }
                    ]}
                    accessible={true}
                    accessibilityLabel={condition}
                  >
                    <Text style={[
                      styles.conditionText,
                      { color: theme.colors.primary.main }
                    ]}>
                      {condition}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        
        {/* Tabs */}
        <View style={[
          styles.tabsContainer,
          { 
            backgroundColor: theme.colors.background.paper,
            borderBottomColor: theme.colors.divider
          }
        ]}>
          <TouchableOpacity 
            style={[
              styles.tab,
              activeTab === 'posts' && [
                styles.activeTab,
                { borderBottomColor: theme.colors.primary.main }
              ]
            ]}
            onPress={() => handleTabChange('posts')}
            accessibilityLabel="Posts tab"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'posts' }}
          >
            <Icon 
              name="grid-outline" 
              size={22} 
              color={activeTab === 'posts' 
                ? theme.colors.primary.main
                : theme.colors.text.secondary
              } 
            />
            <Text 
              style={[
                styles.tabText, 
                activeTab === 'posts' && [
                  styles.activeTabText,
                  { color: theme.colors.primary.main }
                ],
                { color: theme.colors.text.secondary }
              ]}
            >
              Posts
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tab,
              activeTab === 'about' && [
                styles.activeTab,
                { borderBottomColor: theme.colors.primary.main }
              ]
            ]}
            onPress={() => handleTabChange('about')}
            accessibilityLabel="About tab"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'about' }}
          >
            <Icon 
              name="information-circle-outline" 
              size={22} 
              color={activeTab === 'about' 
                ? theme.colors.primary.main
                : theme.colors.text.secondary
              } 
            />
            <Text 
              style={[
                styles.tabText, 
                activeTab === 'about' && [
                  styles.activeTabText,
                  { color: theme.colors.primary.main }
                ],
                { color: theme.colors.text.secondary }
              ]}
            >
              About
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Content based on active tab */}
        {activeTab === 'posts' ? (
          <View style={styles.postsContainer}>
            {userIsBlocked ? (
              <View style={styles.emptyContainer}>
                <Icon name="eye-off-outline" size={50} color={theme.colors.gray[300]} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
                  Posts Hidden
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
                  You've blocked this user, so their posts are hidden
                </Text>
                <TouchableOpacity 
                  style={[
                    styles.unblockButton,
                    { backgroundColor: theme.colors.primary.main }
                  ]}
                  onPress={handleBlockToggle}
                  accessibilityLabel="Unblock user"
                  accessibilityRole="button"
                >
                  <Text style={styles.unblockButtonText}>Unblock User</Text>
                </TouchableOpacity>
              </View>
            ) : postsLoading ? (
              <View style={styles.loadingPosts}>
                <ActivityIndicator size="large" color={theme.colors.primary.main} />
              </View>
            ) : posts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="images-outline" size={50} color={theme.colors.gray[300]} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
                  No Posts Yet
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
                  This user hasn't shared any posts
                </Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={posts}
                keyExtractor={item => item.id}
                numColumns={3}
                scrollEnabled={false}
                renderItem={renderPostItem}
                contentContainerStyle={styles.postsGrid}
                accessibilityLabel={`${posts.length} posts from ${displayName}`}
              />
            )}
          </View>
        ) : (
          <View style={[
            styles.aboutContainer,
            { backgroundColor: theme.colors.background.paper }
          ]}>
            {!userIsBlocked ? (
              <>
                <View style={[styles.infoRow, { borderBottomColor: theme.colors.divider }]}>
                  <Icon name="mail-outline" size={20} color={theme.colors.text.secondary} />
                  <Text 
                    style={[styles.infoText, { color: theme.colors.text.primary }]}
                    accessibilityLabel={`Email: ${userData?.email || 'No email provided'}`}
                  >
                    {userData?.email || 'No email provided'}
                  </Text>
                </View>
                
                <View style={[styles.infoRow, { borderBottomColor: theme.colors.divider }]}>
                  <Icon name="transgender-outline" size={20} color={theme.colors.text.secondary} />
                  <Text 
                    style={[styles.infoText, { color: theme.colors.text.primary }]}
                    accessibilityLabel={`Gender: ${userData?.gender || 'Not specified'}`}
                  >
                    {userData?.gender || 'Not specified'}
                  </Text>
                </View>
                
                <View style={[styles.infoRow, { borderBottomColor: theme.colors.divider }]}>
                  <Icon name="calendar-outline" size={20} color={theme.colors.text.secondary} />
                  <Text 
                    style={[styles.infoText, { color: theme.colors.text.primary }]}
                    accessibilityLabel={`Joined ${formatJoinDate()}`}
                  >
                    Joined {formatJoinDate()}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Icon name="eye-off-outline" size={50} color={theme.colors.gray[300]} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
                  Information Hidden
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
                  You've blocked this user, so their information is hidden
                </Text>
                <TouchableOpacity 
                  style={[
                    styles.unblockButton,
                    { backgroundColor: theme.colors.primary.main }
                  ]}
                  onPress={handleBlockToggle}
                  accessibilityLabel="Unblock user"
                  accessibilityRole="button"
                >
                  <Text style={styles.unblockButtonText}>Unblock User</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      
      {/* Block User Modal */}
      <Modal
        visible={blockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background.paper }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={[
                styles.modalTitle,
                { color: theme.colors.text.primary }
              ]}>
                Block {displayName}
              </Text>
              <TouchableOpacity 
                onPress={() => setBlockModalVisible(false)}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Icon name="close" size={24} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={[
              styles.modalDescription,
              { color: theme.colors.text.secondary }
            ]}>
              When you block someone, they won't be able to follow you or view your posts.
              They also won't be notified that you blocked them.
            </Text>
            
            <Text style={[
              styles.reasonLabel,
              { color: theme.colors.text.primary }
            ]}>
              Reason for blocking (optional):
            </Text>
            
            <View style={styles.reasonOptions}>
              <TouchableOpacity 
                style={[
                  styles.reasonOption,
                  blockReason === 'Harassment' && [
                    styles.selectedReasonOption,
                    { backgroundColor: theme.colors.primary.lightest }
                  ]
                ]}
                onPress={() => setBlockReason('Harassment')}
                accessibilityLabel="Harassment"
                accessibilityRole="radio"
                accessibilityState={{ checked: blockReason === 'Harassment' }}
              >
                <Text style={[
                  styles.reasonText,
                  blockReason === 'Harassment' && { color: theme.colors.primary.main }
                ]}>
                  Harassment
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.reasonOption,
                  blockReason === 'Inappropriate Content' && [
                    styles.selectedReasonOption,
                    { backgroundColor: theme.colors.primary.lightest }
                  ]
                ]}
                onPress={() => setBlockReason('Inappropriate Content')}
                accessibilityLabel="Inappropriate Content"
                accessibilityRole="radio"
                accessibilityState={{ checked: blockReason === 'Inappropriate Content' }}
              >
                <Text style={[
                  styles.reasonText,
                  blockReason === 'Inappropriate Content' && { color: theme.colors.primary.main }
                ]}>
                  Inappropriate Content
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.reasonOption,
                  blockReason === 'Spam' && [
                    styles.selectedReasonOption,
                    { backgroundColor: theme.colors.primary.lightest }
                  ]
                ]}
                onPress={() => setBlockReason('Spam')}
                accessibilityLabel="Spam"
                accessibilityRole="radio"
                accessibilityState={{ checked: blockReason === 'Spam' }}
              >
                <Text style={[
                  styles.reasonText,
                  blockReason === 'Spam' && { color: theme.colors.primary.main }
                ]}>
                  Spam
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.reasonOption,
                  blockReason === 'Other' && [
                    styles.selectedReasonOption,
                    { backgroundColor: theme.colors.primary.lightest }
                  ]
                ]}
                onPress={() => setBlockReason('Other')}
                accessibilityLabel="Other"
                accessibilityRole="radio"
                accessibilityState={{ checked: blockReason === 'Other' }}
              >
                <Text style={[
                  styles.reasonText,
                  blockReason === 'Other' && { color: theme.colors.primary.main }
                ]}>
                  Other
                </Text>
              </TouchableOpacity>
            </View>
            
            {blockReason === 'Other' && (
              <TextInput
                style={[
                  styles.customReasonInput,
                  { 
                    color: theme.colors.text.primary,
                    backgroundColor: theme.colors.background.input,
                    borderColor: theme.colors.divider 
                  }
                ]}
                placeholder="Please specify a reason..."
                placeholderTextColor={theme.colors.text.hint}
                value={customBlockReason}
                onChangeText={setCustomBlockReason}
                maxLength={100}
                multiline
                accessibilityLabel="Custom reason for blocking"
                accessibilityHint="Enter your own reason for blocking this user"
              />
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[
                  styles.cancelButton,
                  { borderColor: theme.colors.divider }
                ]}
                onPress={() => setBlockModalVisible(false)}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
              >
                <Text style={[
                  styles.cancelButtonText,
                  { color: theme.colors.text.primary }
                ]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.blockButton,
                  { backgroundColor: theme.colors.error.main }
                ]}
                onPress={handleSubmitBlock}
                accessibilityLabel="Block User"
                accessibilityRole="button"
              >
                <Text style={styles.blockButtonText}>
                  Block User
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Report User Modal */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.background.paper }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={[
                styles.modalTitle,
                { color: theme.colors.text.primary }
              ]}>
                Report {displayName}
              </Text>
              <TouchableOpacity 
                onPress={() => setReportModalVisible(false)}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <Icon name="close" size={24} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={[
              styles.modalDescription,
              { color: theme.colors.text.secondary }
            ]}>
              Please select a reason for reporting this user. Our team will review the report.
            </Text>
            
            <View style={styles.reportOptions}>
              <TouchableOpacity 
                style={[
                  styles.reportOption,
                  { borderBottomColor: theme.colors.divider }
                ]}
                onPress={() => submitReport('Harassment or Bullying')}
                accessibilityLabel="Report for Harassment or Bullying"
                accessibilityRole="button"
              >
                <Icon name="alert-circle-outline" size={20} color={theme.colors.error.main} />
                <Text style={[
                  styles.reportOptionText,
                  { color: theme.colors.text.primary }
                ]}>
                  Harassment or Bullying
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.reportOption,
                  { borderBottomColor: theme.colors.divider }
                ]}
                onPress={() => submitReport('Inappropriate Content')}
                accessibilityLabel="Report for Inappropriate Content"
                accessibilityRole="button"
              >
                <Icon name="eye-off-outline" size={20} color={theme.colors.error.main} />
                <Text style={[
                  styles.reportOptionText,
                  { color: theme.colors.text.primary }
                ]}>
                  Inappropriate Content
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.reportOption,
                  { borderBottomColor: theme.colors.divider }
                ]}
                onPress={() => submitReport('Spam or Scam')}
                accessibilityLabel="Report for Spam or Scam"
                accessibilityRole="button"
              >
                <Icon name="mail-unread-outline" size={20} color={theme.colors.error.main} />
                <Text style={[
                  styles.reportOptionText,
                  { color: theme.colors.text.primary }
                ]}>
                  Spam or Scam
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.reportOption,
                  { borderBottomColor: theme.colors.divider }
                ]}
                onPress={() => submitReport('False Medical Information')}
                accessibilityLabel="Report for False Medical Information"
                accessibilityRole="button"
              >
                <Icon name="medical-outline" size={20} color={theme.colors.error.main} />
                <Text style={[
                  styles.reportOptionText,
                  { color: theme.colors.text.primary }
                ]}>
                  False Medical Information
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.reportOption}
                onPress={() => submitReport('Other')}
                accessibilityLabel="Report for Other reason"
                accessibilityRole="button"
              >
                <Icon name="ellipsis-horizontal" size={20} color={theme.colors.error.main} />
                <Text style={[
                  styles.reportOptionText,
                  { color: theme.colors.text.primary }
                ]}>
                  Other
                </Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={[
                styles.cancelButton,
                { borderColor: theme.colors.divider, marginTop: 12 }
              ]}
              onPress={() => setReportModalVisible(false)}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
            >
              <Text style={[
                styles.cancelButtonText,
                { color: theme.colors.text.primary }
              ]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  profileImageContainer: {
    marginBottom: 15,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderProfile: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  bio: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 15,
  },
  blockedText: {
    marginLeft: 8,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
  },
  statDivider: {
    width: 1,
    height: '80%',
  },
  actionsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionButtonText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  followButton: {
    flex: 1.2,
  },
  followButtonText: {
    color: 'white',
  },
  followingButton: {
    backgroundColor: 'transparent',
  },
  conditionsContainer: {
    width: '100%',
    marginTop: 5,
  },
  conditionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  conditionsList: {
    paddingBottom: 10,
  },
  conditionTag: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  conditionText: {
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    marginLeft: 5,
    fontSize: 16,
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  postsContainer: {
    flex: 1,
    minHeight: 300,
  },
  postsGrid: {
    padding: 1,
  },
  loadingPosts: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  unblockButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  unblockButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  aboutContainer: {
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalDescription: {
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  reasonOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  reasonOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    margin: 4,
  },
  selectedReasonOption: {
    borderColor: 'transparent',
  },
  reasonText: {
    fontSize: 14,
  },
  customReasonInput: {
    height: 100,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  blockButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  blockButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reportOptions: {
    marginBottom: 12,
  },
  reportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  reportOptionText: {
    fontSize: 16,
    marginLeft: 12,
  }
});

export default UserProfileScreen;
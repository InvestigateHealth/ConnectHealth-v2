// src/screens/UserProfileScreen.js
// Screen for viewing other users' profiles with blocking functionality

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
  TextInput
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

const UserProfileScreen = ({ route, navigation }) => {
  const { userId } = route.params;
  const { theme } = useTheme();
  const { user, userData: currentUserData, isUserBlocked, blockUser, unblockUser } = useUser();
  const { isConnected } = useNetInfo();
  
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
  
  const isMounted = useRef(true);
  const postsListener = useRef(null);
  const connectionListener = useRef(null);

  // Set isMounted flag for preventing state updates after unmount
  useEffect(() => {
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

  // Fetch user data
  const fetchUserData = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);
      
      const userDoc = await firestore()
        .collection('users')
        .doc(userId)
        .get();
      
      if (userDoc.exists && isMounted.current) {
        const data = userDoc.data();
        setUserData({
          id: userDoc.id,
          ...data,
          joinDate: data.joinDate ? data.joinDate.toDate() : new Date()
        });
        
        // Update navigation title if not already set
        if (route.params?.title === 'User Profile') {
          navigation.setOptions({
            title: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'User Profile'
          });
        }
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
      }
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

  // Share user profile
  const handleShareProfile = async () => {
    if (!userData) return;
    
    try {
      // Generate a dynamic link or a deep link to the user's profile
      const profileUrl = `healthconnect://user/${userId}`;
      const userName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
      
      await Share.share({
        message: `Connect with ${userName} on HealthConnect: ${profileUrl}`,
        url: Platform.OS === 'ios' ? profileUrl : undefined,
        title: 'Connect on HealthConnect'
      });
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
      const success = await blockUser(userId, blockReason);
      
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
        timestamp: firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        reviewed: false
      });
      
      setReportModalVisible(false);
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. We will review this user.'
      );
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
  const renderPostItem = useCallback(({ item }) => (
    <PostThumbnail 
      post={item} 
      onPress={() => navigation.navigate('PostDetail', { 
        postId: item.id,
        title: 'Post Details'
      })}
    />
  ), [navigation]);
  
  // Render loading indicator
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background.default }]}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
          Loading profile...
        </Text>
      </View>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background.default }]}>
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
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Get display name
  const displayName = userData 
    ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() 
    : 'User';
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.default }]}>
      <ScrollView>
        {/* User info header */}
        <View style={[styles.header, { backgroundColor: theme.colors.background.paper }]}>
          <View style={styles.profileImageContainer}>
            {userData?.profileImageURL ? (
              <FastImage
                style={styles.profileImage}
                source={{ uri: userData.profileImageURL }}
                resizeMode={FastImage.resizeMode.cover}
                defaultSource={require('../assets/default-avatar.png')}
              />
            ) : (
              <View style={[
                styles.profileImage, 
                styles.placeholderProfile,
                { backgroundColor: theme.colors.gray[400] }
              ]}>
                <Icon name="person" size={40} color="#FFF" />
              </View>
            )}
          </View>
          
          <Text style={[styles.userName, { color: theme.colors.text.primary }]}>
            {displayName}
          </Text>
          
          {userData?.bio && !userIsBlocked && (
            <Text style={[styles.bio, { color: theme.colors.text.secondary }]}>
              {userData.bio}
            </Text>
          )}
          
          {userIsBlocked && (
            <View style={[styles.blockedBanner, { backgroundColor: theme.colors.error.light }]}>
              <Icon name="ban" size={20} color={theme.colors.error.main} />
              <Text style={[styles.blockedText, { color: theme.colors.error.main }]}>
                You have blocked this user
              </Text>
            </View>
          )}
          
          {/* Stats section */}
          <View style={[
            styles.statsContainer,
            { 
              borderColor: theme.colors.divider 
            }
          ]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text.primary }]}>
                {stats.postsCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
                Posts
              </Text>
            </View>
            
            <View style={[styles.statDivider, { backgroundColor: theme.colors.divider }]} />
            
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text.primary }]}>
                {stats.followersCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
                Followers
              </Text>
            </View>
            
            <View style={[styles.statDivider, { backgroundColor: theme.colors.divider }]} />
            
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.text.primary }]}>
                {stats.followingCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
                Following
              </Text>
            </View>
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
            <View style={styles.conditionsContainer}>
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
              >
                {userData.medicalConditions.map((condition, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.conditionTag,
                      { backgroundColor: theme.colors.primary.lightest }
                    ]}
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
            onPress={() => setActiveTab('posts')}
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
            onPress={() => setActiveTab('about')}
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
                data={posts}
                keyExtractor={item => item.id}
                numColumns={3}
                scrollEnabled={false}
                renderItem={renderPostItem}
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
                  <Text style={[styles.infoText, { color: theme.colors.text.primary }]}>
                    {userData?.email || 'No email provided'}
                  </Text>
                </View>
                
                <View style={[styles.infoRow, { borderBottomColor: theme.colors.divider }]}>
                  <Icon name="transgender-outline" size={20} color={theme.colors.text.secondary} />
                  <Text style={[styles.infoText, { color: theme.colors.text.primary }]}>
                    {userData?.gender || 'Not specified'}
                  </Text>
                </View>
                
                <View style={[styles.infoRow, { borderBottomColor: theme.colors.divider }]}>
                  <Icon name="calendar-outline" size={20} color={theme.colors.text.secondary} />
                  <Text style={[styles.infoText, { color: theme.colors.text.primary }]}>
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
              <TouchableOpacity onPress={() => setBlockModalVisible(false)}>
                <Icon name="close" size={24} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={[
              styles.modalDescription,
              
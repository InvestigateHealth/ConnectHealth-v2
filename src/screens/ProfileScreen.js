// src/screens/ProfileScreen.js
// User's own profile screen with account management

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Share,
  Platform,
  ActionSheetIOS,
  Switch
} from 'react-native';
import FastImage from 'react-native-fast-image';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../theme/ThemeContext';
import { useNetInfo } from '@react-native-community/netinfo';
import PostThumbnail from '../components/PostThumbnail';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../hooks/useNotifications';
import * as Haptics from '../utils/haptics';
import { AnalyticsService } from '../services/AnalyticsService';

const ProfileScreen = ({ navigation }) => {
  const { user, userData, updateUserData, signOut } = useUser();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { isConnected } = useNetInfo();
  const { notificationsEnabled, toggleNotifications } = useNotifications();
  const insets = useSafeAreaInsets();
  
  // States
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' or 'settings'
  const [stats, setStats] = useState({
    followersCount: 0,
    followingCount: 0,
    postsCount: 0
  });
  const [profileImageUploading, setProfileImageUploading] = useState(false);
  
  // Refs
  const isMounted = useRef(true);
  const postsListener = useRef(null);
  
  // Cleanup on unmount
  useEffect(() => {
    // Log screen view for analytics
    AnalyticsService.logScreenView('Profile');
    
    return () => {
      isMounted.current = false;
      
      if (postsListener.current) {
        postsListener.current();
        postsListener.current = null;
      }
    };
  }, []);

  // Load posts when user data is available
  useEffect(() => {
    if (user && userData && activeTab === 'posts') {
      fetchUserPosts();
      fetchUserStats();
    }
  }, [user, userData, activeTab]);

  // Function to fetch user posts with realtime updates
  const fetchUserPosts = useCallback(() => {
    if (!user) return;
    
    try {
      setPostsLoading(true);
      
      // Clean up existing listener if any
      if (postsListener.current) {
        postsListener.current();
        postsListener.current = null;
      }
      
      // Set up realtime listener
      postsListener.current = firestore()
        .collection('posts')
        .where('userId', '==', user.uid)
        .orderBy('timestamp', 'desc')
        .limit(20)
        .onSnapshot(snapshot => {
          if (isMounted.current) {
            const postsData = snapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                timestamp: data.timestamp?.toDate() || new Date(),
              };
            });
            
            setPosts(postsData);
            setPostsLoading(false);
            setLoading(false);
            setRefreshing(false);
            
            // Update post count in stats
            setStats(prev => ({
              ...prev,
              postsCount: postsData.length
            }));
          }
        }, error => {
          console.error('Error in posts listener:', error);
          if (isMounted.current) {
            setPostsLoading(false);
            setLoading(false);
            setRefreshing(false);
          }
        });
    } catch (error) {
      console.error('Error setting up posts listener:', error);
      if (isMounted.current) {
        setPostsLoading(false);
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user]);

  // Function to fetch user stats (followers, following)
  const fetchUserStats = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch followers
      const followersSnapshot = await firestore()
        .collection('connections')
        .where('connectedUserId', '==', user.uid)
        .get();
      
      // Fetch following
      const followingSnapshot = await firestore()
        .collection('connections')
        .where('userId', '==', user.uid)
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
  }, [user]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (!isConnected) {
      Alert.alert('Offline', 'Cannot refresh while offline');
      return;
    }
    
    setRefreshing(true);
    fetchUserPosts();
    fetchUserStats();
  }, [isConnected, fetchUserPosts, fetchUserStats]);

  // Handle profile image selection and upload
  const handleChangeProfileImage = useCallback(async () => {
    if (!isConnected) {
      Alert.alert('Offline', 'Cannot change profile image while offline');
      return;
    }
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Change Profile Picture', 'Remove Profile Picture'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            selectAndUploadImage();
          } else if (buttonIndex === 2) {
            confirmRemoveProfileImage();
          }
        }
      );
    } else {
      // For Android and other platforms
      Alert.alert(
        'Profile Picture',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Change Photo', onPress: selectAndUploadImage },
          { text: 'Remove Photo', onPress: confirmRemoveProfileImage, style: 'destructive' }
        ]
      );
    }
  }, [isConnected]);

  // Select and upload a new profile image
  const selectAndUploadImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
        includeBase64: false,
      });
      
      if (result.didCancel) return;
      
      if (result.errorCode) {
        throw new Error(result.errorMessage || 'Error selecting image');
      }
      
      if (result.assets && result.assets.length > 0) {
        const image = result.assets[0];
        
        // Check file size (limit to 5MB)
        if (image.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Error', 'Image is too large. Please select an image smaller than 5MB.');
          return;
        }
        
        // Upload the image
        await uploadProfileImage(image.uri);
      }
    } catch (error) {
      console.error('Error selecting/uploading image:', error);
      Alert.alert('Error', 'Failed to change profile picture. Please try again.');
    }
  };

  // Upload profile image to Firebase Storage
  const uploadProfileImage = async (imageUri) => {
    if (!imageUri || !user) return;
    
    try {
      setProfileImageUploading(true);
      Haptics.impactMedium();
      
      // Generate a unique filename
      const filename = `profile_${user.uid}_${Date.now()}.jpg`;
      const storageRef = storage().ref(`profile_images/${filename}`);
      
      // Upload image
      await storageRef.putFile(imageUri);
      
      // Get download URL
      const downloadUrl = await storageRef.getDownloadURL();
      
      // Delete old profile image if exists
      if (userData?.profileImageURL) {
        try {
          // Extract old filename from URL
          const oldRef = storage().refFromURL(userData.profileImageURL);
          await oldRef.delete();
        } catch (error) {
          console.log('Warning: Could not delete old profile image', error);
          // Continue even if deletion fails
        }
      }
      
      // Update user data with new URL
      await updateUserData({
        profileImageURL: downloadUrl
      });
      
      // Log analytics event
      AnalyticsService.logEvent('profile_image_updated');
      
    } catch (error) {
      console.error('Error uploading profile image:', error);
      Alert.alert('Error', 'Failed to upload profile image. Please try again.');
    } finally {
      setProfileImageUploading(false);
    }
  };

  // Confirm and remove profile image
  const confirmRemoveProfileImage = () => {
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: removeProfileImage }
      ]
    );
  };

  // Remove profile image
  const removeProfileImage = async () => {
    if (!userData?.profileImageURL) return;
    
    try {
      setProfileImageUploading(true);
      
      // Delete profile image from storage
      try {
        const oldRef = storage().refFromURL(userData.profileImageURL);
        await oldRef.delete();
      } catch (error) {
        console.log('Warning: Could not delete profile image from storage', error);
        // Continue even if deletion fails
      }
      
      // Update user data to remove URL
      await updateUserData({
        profileImageURL: null
      });
      
      // Log analytics event
      AnalyticsService.logEvent('profile_image_removed');
      
    } catch (error) {
      console.error('Error removing profile image:', error);
      Alert.alert('Error', 'Failed to remove profile image. Please try again.');
    } finally {
      setProfileImageUploading(false);
    }
  };

  // Navigate to edit profile screen
  const goToEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  // Navigate to followers list
  const navigateToFollowers = () => {
    if (stats.followersCount > 0) {
      navigation.navigate('UserFollowers', { 
        userId: user.uid,
        title: 'Your Followers'
      });
    }
  };
  
  // Navigate to following list
  const navigateToFollowing = () => {
    if (stats.followingCount > 0) {
      navigation.navigate('UserFollowing', { 
        userId: user.uid,
        title: 'Your Following'
      });
    }
  };

  // Share profile
  const handleShareProfile = async () => {
    if (!user) return;
    
    try {
      Haptics.impactLight();
      
      // Generate deep link or URI to the profile
      const profileUrl = `healthconnect://user/${user.uid}`;
      const displayName = userData ? 
        `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 
        'me';
      
      await Share.share({
        message: `Connect with ${displayName} on HealthConnect: ${profileUrl}`,
        url: Platform.OS === 'ios' ? profileUrl : undefined,
        title: 'Connect on HealthConnect'
      });
      
      // Log analytics event
      AnalyticsService.logEvent('profile_shared');
    } catch (error) {
      console.error('Error sharing profile:', error);
      Alert.alert('Error', 'Failed to share profile. Please try again.');
    }
  };

  // Handle tab change with haptic feedback
  const handleTabChange = (tab) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      Haptics.selectionLight();
    }
  };

  // Handle logout
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // Navigation happens automatically in App.js when auth state changes
              
              // Log analytics event
              AnalyticsService.logEvent('user_logout');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Navigate to specific settings screen
  const navigateToSettings = (screenName) => {
    navigation.navigate(screenName);
  };

  // Render post item for grid view
  const renderPostItem = useCallback(({ item, index }) => (
    <PostThumbnail 
      post={item} 
      onPress={() => navigation.navigate('PostDetail', { 
        postId: item.id,
        title: 'Post'
      })}
      testID={`post-thumbnail-${index}`}
      accessibilityLabel={`Your post from ${format(item.timestamp, 'MMMM d, yyyy')}`}
    />
  ), [navigation]);

  // Display name formatting
  const displayName = userData 
    ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() 
    : 'User';

  // Loading state
  if (loading && !userData) {
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

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: theme.colors.background.default,
          paddingTop: insets.top
        }
      ]}
      accessibilityLabel="Your profile"
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary.main]}
            tintColor={theme.colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.background.paper }]}>
          {/* Profile Image Section */}
          <View style={styles.profileImageSection}>
            <TouchableOpacity 
              style={styles.profileImageContainer}
              onPress={handleChangeProfileImage}
              disabled={profileImageUploading}
              accessibilityLabel="Change profile picture"
              accessibilityRole="button"
              accessibilityHint="Double tap to change your profile picture"
            >
              {profileImageUploading ? (
                <View style={[
                  styles.profileImage, 
                  styles.uploadingContainer,
                  { backgroundColor: 'rgba(0, 0, 0, 0.3)' }
                ]}>
                  <ActivityIndicator size="large" color="white" />
                </View>
              ) : userData?.profileImageURL ? (
                <FastImage
                  style={styles.profileImage}
                  source={{ uri: userData.profileImageURL }}
                  resizeMode={FastImage.resizeMode.cover}
                  defaultSource={require('../assets/default-avatar.png')}
                />
              ) : (
                <View style={[
                  styles.profileImage, 
                  styles.defaultAvatar,
                  { backgroundColor: theme.colors.gray[400] }
                ]}>
                  <Icon name="person" size={50} color="white" />
                </View>
              )}
              
              <View style={[
                styles.editIconContainer,
                { backgroundColor: theme.colors.primary.main }
              ]}>
                <Icon name="camera" size={16} color="white" />
              </View>
            </TouchableOpacity>
            
            <View style={styles.nameContainer}>
              <Text style={[styles.displayName, { color: theme.colors.text.primary }]}>
                {displayName}
              </Text>
              
              {userData?.bio ? (
                <Text 
                  style={[styles.bio, { color: theme.colors.text.secondary }]}
                  numberOfLines={3}
                >
                  {userData.bio}
                </Text>
              ) : (
                <TouchableOpacity onPress={goToEditProfile}>
                  <Text style={[styles.addBioText, { color: theme.colors.primary.main }]}>
                    Add a bio
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Stats Section */}
          <View style={[
            styles.statsContainer,
            { borderColor: theme.colors.divider }
          ]}>
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
          
          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={[
                styles.editProfileButton,
                { backgroundColor: theme.colors.primary.main }
              ]}
              onPress={goToEditProfile}
              accessibilityLabel="Edit profile"
              accessibilityRole="button"
            >
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.shareButton,
                { backgroundColor: theme.colors.background.paper }
              ]}
              onPress={handleShareProfile}
              accessibilityLabel="Share profile"
              accessibilityRole="button"
            >
              <Icon name="share-social-outline" size={24} color={theme.colors.primary.main} />
            </TouchableOpacity>
          </View>
          
          {/* Medical Conditions */}
          {userData?.medicalConditions && userData.medicalConditions.length > 0 && (
            <View style={styles.conditionsContainer}>
              <Text style={[
                styles.sectionTitle,
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
              activeTab === 'settings' && [
                styles.activeTab,
                { borderBottomColor: theme.colors.primary.main }
              ]
            ]}
            onPress={() => handleTabChange('settings')}
            accessibilityLabel="Settings tab"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'settings' }}
          >
            <Icon 
              name="settings-outline" 
              size={22} 
              color={activeTab === 'settings' 
                ? theme.colors.primary.main
                : theme.colors.text.secondary
              } 
            />
            <Text 
              style={[
                styles.tabText, 
                activeTab === 'settings' && [
                  styles.activeTabText,
                  { color: theme.colors.primary.main }
                ],
                { color: theme.colors.text.secondary }
              ]}
            >
              Settings
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Content based on active tab */}
        {activeTab === 'posts' ? (
          <View style={styles.postsContainer}>
            {postsLoading ? (
              <View style={styles.loadingPostsContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary.main} />
              </View>
            ) : posts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="images-outline" size={50} color={theme.colors.gray[300]} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
                  No Posts Yet
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
                  Share your first post with the community
                </Text>
                <TouchableOpacity 
                  style={[
                    styles.createPostButton,
                    { backgroundColor: theme.colors.primary.main }
                  ]}
                  onPress={() => navigation.navigate('NewPost')}
                >
                  <Text style={styles.createPostText}>Create Post</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={posts}
                keyExtractor={item => item.id}
                renderItem={renderPostItem}
                numColumns={3}
                scrollEnabled={false}
                contentContainerStyle={styles.postsGrid}
              />
            )}
          </View>
        ) : (
          <View style={styles.settingsContainer}>
            {/* Settings Groups */}
            
            {/* Account Settings */}
            <View style={[
              styles.settingsGroup,
              { backgroundColor: theme.colors.background.paper }
            ]}>
              <Text style={[
                styles.settingsGroupTitle,
                { color: theme.colors.text.primary }
              ]}>
                Account
              </Text>
              
              <TouchableOpacity 
                style={[
                  styles.settingsItem,
                  { borderBottomColor: theme.colors.divider }
                ]}
                onPress={goToEditProfile}
              >
                <Icon name="person-outline" size={22} color={theme.colors.text.secondary} />
                <Text style={[styles.settingsItemText, { color: theme.colors.text.primary }]}>
                  Edit Profile
                </Text>
                <Icon name="chevron-forward" size={18} color={theme.colors.text.hint} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.settingsItem,
                  { borderBottomColor: theme.colors.divider }
                ]}
                onPress={() => navigateToSettings('BlockedUsers')}
              >
                <Icon name="ban-outline" size={22} color={theme.colors.text.secondary} />
                <Text style={[styles.settingsItemText, { color: theme.colors.text.primary }]}>
                  Blocked Users
                </Text>
                <Icon name="chevron-forward" size={18} color={theme.colors.text.hint} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.settingsItem}
                onPress={() => navigateToSettings('PrivacySettings')}
              >
                <Icon name="lock-closed-outline" size={22} color={theme.colors.text.secondary} />
                <Text style={[styles.settingsItemText, { color: theme.colors.text.primary }]}>
                  Privacy
                </Text>
                <Icon name="chevron-forward" size={18} color={theme.colors.text.hint} />
              </TouchableOpacity>
            </View>
            
            {/* Appearance Settings */}
            <View style={[
              styles.settingsGroup,
              { backgroundColor: theme.colors.background.paper }
            ]}>
              <Text style={[
                styles.settingsGroupTitle,
                { color: theme.colors.text.primary }
              ]}>
                Appearance
              </Text>
              
              <View 
                style={[
                  styles.settingsItem,
                  { borderBottomColor: theme.colors.divider }
                ]}
              >
                <Icon name="moon-outline" size={22} color={theme.colors.text.secondary} />
                <Text style={[styles.settingsItemText, { color: theme.colors.text.primary }]}>
                  Dark Mode
                </Text>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{
                    false: theme.colors.divider,
                    true: theme.colors.primary.light
                  }}
                  thumbColor={isDarkMode ? theme.colors.primary.main : '#f4f3f4'}
                />
              </View>
              
              <TouchableOpacity 
                style={styles.settingsItem}
                onPress={() => navigateToSettings('AccessibilitySettings')}
              >
                <Icon name="accessibility-outline" size={22} color={theme.colors.text.secondary} />
                <Text style={[styles.settingsItemText, { color: theme.colors.text.primary }]}>
                  Accessibility
                </Text>
                <Icon name="chevron-forward" size={18} color={theme.colors.text.hint} />
              </TouchableOpacity>
            </View>
            
            {/* Notifications */}
            <View style={[
              styles.settingsGroup,
              { backgroundColor: theme.colors.background.paper }
            ]}>
              <Text style={[
                styles.settingsGroupTitle,
                { color: theme.colors.text.primary }
              ]}>
                Notifications
              </Text>
              
              <View 
                style={styles.settingsItem}
              >
                <Icon name="notifications-outline" size={22} color={theme.colors.text.secondary} />
                <Text style={[styles.settingsItemText, { color: theme.colors.text.primary }]}>
                  Push Notifications
                </Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={{
                    false: theme.colors.divider,
                    true: theme.colors.primary.light
                  }}
                  thumbColor={notificationsEnabled ? theme.colors.primary.main : '#f4f3f4'}
                />
              </View>
            </View>
            
            {/* More Settings */}
            <View style={[
              styles.settingsGroup,
              { backgroundColor: theme.colors.background.paper }
            ]}>
              <Text style={[
                styles.settingsGroupTitle,
                { color: theme.colors.text.primary }
              ]}>
                More
              </Text>
              
              <TouchableOpacity 
                style={[
                  styles.settingsItem,
                  { borderBottomColor: theme.colors.divider }
                ]}
                onPress={() => navigateToSettings('About')}
              >
                <Icon name="information-circle-outline" size={22} color={theme.colors.text.secondary} />
                <Text style={[styles.settingsItemText, { color: theme.colors.text.primary }]}>
                  About HealthConnect
                </Text>
                <Icon name="chevron-forward" size={18} color={theme.colors.text.hint} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.settingsItem,
                  { borderBottomColor: theme.colors.divider }
                ]}
                onPress={() => navigateToSettings('LanguageSettings')}
              >
                <Icon name="language-outline" size={22} color={theme.colors.text.secondary} />
                <Text style={[styles.settingsItemText, { color: theme.colors.text.primary }]}>
                  Language
                </Text>
                <Icon name="chevron-forward" size={18} color={theme.colors.text.hint} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.settingsItem}
                onPress={handleLogout}
              >
                <Icon name="log-out-outline" size={22} color={theme.colors.error.main} />
                <Text style={[styles.settingsItemText, { color: theme.colors.error.main }]}>
                  Log Out
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Version Info */}
            <Text style={[
              styles.versionText,
              { color: theme.colors.text.hint }
            ]}>
              Version 0.1.0
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* Floating Action Button for creating post */}
      {activeTab === 'posts' && (
        <TouchableOpacity
          style={[
            styles.fab,
            { backgroundColor: theme.colors.primary.main }
          ]}
          onPress={() => navigation.navigate('NewPost')}
          accessibilityLabel="Create new post"
          accessibilityRole="button"
        >
          <Icon name="add" size={24} color="white" />
        </TouchableOpacity>
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
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  profileImageSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  defaultAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  nameContainer: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    lineHeight: 18,
  },
  addBioText: {
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  statItem: {
    alignItems: 'center',
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
  actionButtonsContainer: {
    flexDirection: 'row',
    marginVertical: 16,
  },
  editProfileButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  editProfileText: {
    color: 'white',
    fontWeight: 'bold',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  conditionsContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  conditionsList: {
    paddingBottom: 8,
  },
  conditionTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 15,
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  postsContainer: {
    flex: 1,
  },
  loadingPostsContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  postsGrid: {
    padding: 1,
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
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  createPostButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  createPostText: {
    color: 'white',
    fontWeight: 'bold',
  },
  settingsContainer: {
    flex: 1,
    paddingBottom: 20,
  },
  settingsGroup: {
    marginTop: 16,
    borderRadius: 10,
    overflow: 'hidden',
  },
  settingsGroupTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingsItemText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
  },
  versionText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  }
});

export default ProfileScreen;
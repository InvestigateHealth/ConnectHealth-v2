// src/screens/ProfileScreen.js
// User profile screen - FIXED

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Share,
  Alert,
  ActivityIndicator
} from 'react-native';
import FastImage from 'react-native-fast-image';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { useUser } from '../contexts/UserContext';
import PostThumbnail from '../components/PostThumbnail';

const ProfileScreen = ({ navigation }) => {
  const { userData } = useUser();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' or 'about'
  const [stats, setStats] = useState({
    followersCount: 0,
    followingCount: 0
  });
  const isMounted = useRef(true);

  useEffect(() => {
    // Set up the mounted flag for preventing state updates after unmount
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    fetchUserPosts();
    fetchUserStats();
  }, []);

  const fetchUserPosts = async () => {
    try {
      setLoading(true);
      const postsSnapshot = await firestore()
        .collection('posts')
        .where('userId', '==', auth().currentUser.uid)
        .orderBy('timestamp', 'desc')
        .get();

      // Only update state if component is still mounted
      if (isMounted.current) {
        const postsData = postsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
          };
        });

        setPosts(postsData);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to load posts. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const fetchUserStats = async () => {
    try {
      // Fetch followers count
      const followersSnapshot = await firestore()
        .collection('connections')
        .where('connectedUserId', '==', auth().currentUser.uid)
        .get();

      // Fetch following count
      const followingSnapshot = await firestore()
        .collection('connections')
        .where('userId', '==', auth().currentUser.uid)
        .get();

      if (isMounted.current) {
        setStats({
          followersCount: followersSnapshot.size,
          followingCount: followingSnapshot.size
        });
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to load user stats. Please try again.');
      }
    }
  };

  const handleShareProfile = async () => {
    try {
      // Generate a dynamic link or a deep link to the user's profile
      // In a real app, this would use Firebase Dynamic Links or a similar service
      const profileUrl = `healthconnect://user/${auth().currentUser.uid}`;
      
      await Share.share({
        message: `Connect with me on HealthConnect: ${profileUrl}`,
        url: profileUrl,
        title: 'Join me on HealthConnect'
      });
    } catch (error) {
      console.error('Error sharing profile:', error);
      Alert.alert('Error', 'Failed to share profile. Please try again.');
    }
  };
  
  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Log Out', 
          onPress: async () => {
            try {
              await auth().signOut();
              // The App.js will handle navigation when auth state changes
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          }
        }
      ]
    );
  };
  
  const handleEditProfile = () => {
    // Navigate to edit profile screen (would need to be created)
    navigation.navigate('EditProfile');
  };
  
  if (!userData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }
  
  // Format join date safely
  const formatJoinDate = () => {
    try {
      if (!userData.joinDate) return 'Recently';
      
      // Handle both Firestore timestamp and Date objects
      const dateObject = userData.joinDate.toDate 
        ? userData.joinDate.toDate() 
        : new Date(userData.joinDate);
        
      return format(dateObject, 'MMMM yyyy');
    } catch (error) {
      console.error('Error formatting join date:', error);
      return 'Recently';
    }
  };
  
  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.profileImageContainer}>
            {userData.profileImageURL ? (
              <FastImage
                style={styles.profileImage}
                source={{ uri: userData.profileImageURL }}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <View style={[styles.profileImage, styles.placeholderProfile]}>
                <Icon name="person" size={40} color="#FFF" />
              </View>
            )}
          </View>
          
          <Text style={styles.userName}>
            {userData.firstName || ''} {userData.lastName || ''}
          </Text>
          
          {userData.bio && (
            <Text style={styles.bio}>{userData.bio}</Text>
          )}
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleEditProfile}
            >
              <Text style={styles.actionButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleShareProfile}
            >
              <Text style={styles.actionButtonText}>Share Profile</Text>
            </TouchableOpacity>
          </View>
          
          {userData.medicalConditions && userData.medicalConditions.length > 0 && (
            <View style={styles.conditionsContainer}>
              <Text style={styles.conditionsTitle}>Medical Conditions</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.conditionsList}
              >
                {userData.medicalConditions.map((condition, index) => (
                  <View key={index} style={styles.conditionTag}>
                    <Text style={styles.conditionText}>{condition}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => setActiveTab('posts')}
          >
            <Icon 
              name="grid-outline" 
              size={22} 
              color={activeTab === 'posts' ? '#2196F3' : '#78909C'} 
            />
            <Text 
              style={[
                styles.tabText, 
                activeTab === 'posts' && styles.activeTabText
              ]}
            >
              Posts
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'about' && styles.activeTab]}
            onPress={() => setActiveTab('about')}
          >
            <Icon 
              name="information-circle-outline" 
              size={22} 
              color={activeTab === 'about' ? '#2196F3' : '#78909C'} 
            />
            <Text 
              style={[
                styles.tabText, 
                activeTab === 'about' && styles.activeTabText
              ]}
            >
              About
            </Text>
          </TouchableOpacity>
        </View>
        
        {activeTab === 'posts' ? (
          <View style={styles.postsContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
            ) : posts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="images-outline" size={50} color="#B0BEC5" />
                <Text style={styles.emptyTitle}>No Posts Yet</Text>
                <Text style={styles.emptySubtitle}>
                  When you create posts, they'll appear here
                </Text>
              </View>
            ) : (
              <FlatList
                data={posts}
                keyExtractor={item => item.id}
                numColumns={3}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <PostThumbnail 
                    post={item} 
                    onPress={() => navigation.navigate('PostDetail', { 
                      postId: item.id,
                      title: 'Post Details'
                    })}
                  />
                )}
              />
            )}
          </View>
        ) : (
          <View style={styles.aboutContainer}>
            <View style={styles.infoRow}>
              <Icon name="mail-outline" size={20} color="#546E7A" />
              <Text style={styles.infoText}>{userData.email || 'No email provided'}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Icon name="transgender-outline" size={20} color="#546E7A" />
              <Text style={styles.infoText}>{userData.gender || 'Not specified'}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Icon name="calendar-outline" size={20} color="#546E7A" />
              <Text style={styles.infoText}>
                Joined {formatJoinDate()}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Icon name="log-out-outline" size={20} color="#F44336" />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// Styles remain the same, they would be included here...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7F8',
  },
  header: {
    backgroundColor: 'white',
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
    backgroundColor: '#90A4AE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 5,
  },
  bio: {
    fontSize: 16,
    color: '#546E7A',
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ECEFF1',
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#263238',
  },
  statLabel: {
    fontSize: 14,
    color: '#78909C',
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#ECEFF1',
  },
  actionsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  actionButtonText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  conditionsContainer: {
    width: '100%',
    marginTop: 5,
  },
  conditionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 10,
  },
  conditionsList: {
    paddingBottom: 10,
  },
  conditionTag: {
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  conditionText: {
    color: '#2196F3',
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
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
    borderBottomColor: '#2196F3',
  },
  tabText: {
    marginLeft: 5,
    fontSize: 16,
    color: '#78909C',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  postsContainer: {
    flex: 1,
    backgroundColor: '#F5F7F8',
    minHeight: 300,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#455A64',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#78909C',
    textAlign: 'center',
    marginTop: 5,
  },
  aboutContainer: {
    backgroundColor: 'white',
    padding: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  infoText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#455A64',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    paddingVertical: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 5,
  },
  logoutText: {
    color: '#F44336',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  loader: {
    padding: 20,
  },
});

export default ProfileScreen;
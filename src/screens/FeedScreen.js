// src/screens/FeedScreen.js
// Main feed screen showing posts from connections - Updated with proper Firebase integration

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, 
  RefreshControl, TouchableOpacity, Alert
} from 'react-native';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../theme/ThemeContext';
import { PostService } from '../services/FirebaseService';
import PostCard from '../components/PostCard';
import Icon from 'react-native-vector-icons/Ionicons';

const FeedScreen = ({ navigation }) => {
  const { user, blockedUsers } = useUser();
  const { theme } = useTheme();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const isMounted = useRef(true);
  const postsListener = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (postsListener.current) {
        postsListener.current();
      }
    };
  }, []);

  // Fetch posts when user or blockedUsers change
  useEffect(() => {
    if (user) {
      fetchPosts(true);
    }
  }, [user, blockedUsers]);

  // Fetch posts from Firebase
  const fetchPosts = async (reset = false) => {
    if (!user || !isMounted.current) return;

    try {
      setLoading(true);

      // Get posts from the PostService
      const result = await PostService.getFeedPosts(
        user.uid,
        blockedUsers,
        10,
        reset ? null : lastDoc
      );
      
      if (isMounted.current) {
        // Update state based on results
        if (reset) {
          setPosts(result.posts);
        } else {
          setPosts(prevPosts => [...prevPosts, ...result.posts]);
        }
        
        setLastDoc(result.lastDoc);
        setHasMore(result.posts.length === 10);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to load feed. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Handle refresh (pull-to-refresh)
  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts(true);
  };

  // Load more posts when reaching the end of the list
  const loadMorePosts = () => {
    if (!loading && hasMore) {
      fetchPosts();
    }
  };

  // Empty state when no posts are available
  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon 
        name="chatbubble-ellipses-outline" 
        size={60} 
        color={theme.colors.gray[300]} 
      />
      <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
        No posts yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
        Follow others or share your first post
      </Text>
      <TouchableOpacity
        style={[styles.exploreButton, { backgroundColor: theme.colors.primary.main }]}
        onPress={() => navigation.navigate('ExploreTab')}
      >
        <Text style={styles.exploreButtonText}>Find People to Follow</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.default }]}>
      {loading && !refreshing ? (
        <ActivityIndicator 
          size="large" 
          color={theme.colors.primary.main} 
          style={styles.loader} 
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PostCard 
              post={item} 
              navigation={navigation}
              onCommentPress={() => navigation.navigate('Comments', { 
                postId: item.id,
                title: 'Comments'
              })}
              onProfilePress={() => {
                if (item.userId === user.uid) {
                  navigation.navigate('ProfileTab');
                } else {
                  navigation.navigate('UserProfile', { 
                    userId: item.userId,
                    title: item.userFullName
                  });
                }
              }}
            />
          )}
          contentContainerStyle={posts.length === 0 ? styles.emptyList : styles.contentContainer}
          ListEmptyComponent={renderEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary.main]}
              tintColor={theme.colors.primary.main}
            />
          }
          onEndReached={loadMorePosts}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loading && posts.length > 0 ? (
              <ActivityIndicator 
                size="small" 
                color={theme.colors.primary.main} 
                style={styles.footerLoader} 
              />
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  emptyList: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 5,
  },
  exploreButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 20,
  },
  exploreButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default FeedScreen;
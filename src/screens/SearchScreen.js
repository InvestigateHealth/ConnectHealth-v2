// src/screens/SearchScreen.js
// Advanced search screen for finding posts, users, and content

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useDebounce } from '../hooks/useDebounce';
import firestore from '@react-native-firebase/firestore';
import { useUser } from '../contexts/UserContext';
import PostCard from '../components/PostCard';
import UserListItem from '../components/UserListItem';
import SegmentedControl from '../components/SegmentedControl';

const SearchScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { userData } = useUser();
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState('users'); // 'users', 'posts', 'conditions'
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  
  // Results state
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [conditions, setConditions] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  
  // Filter options
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'relevant', 'popular'
  const [timeFilter, setTimeFilter] = useState('all'); // 'today', 'week', 'month', 'all'
  const [showFilters, setShowFilters] = useState(false);
  
  // Handle initial search term from route params
  useEffect(() => {
    if (route.params?.searchTerm) {
      setSearchTerm(route.params.searchTerm);
    }
    
    if (route.params?.searchMode) {
      setSearchMode(route.params.searchMode);
    }
  }, [route.params]);
  
  // Load recent searches when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadRecentSearches();
      
      return () => {
        // Clean up if needed
      };
    }, [])
  );
  
  // Load recent searches from storage
  const loadRecentSearches = async () => {
    try {
      const recentSearchesJson = await AsyncStorage.getItem('recentSearches');
      if (recentSearchesJson) {
        const parsedSearches = JSON.parse(recentSearchesJson);
        setRecentSearches(parsedSearches);
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };
  
  // Save recent search
  const saveRecentSearch = async (term) => {
    try {
      // Don't save empty searches
      if (!term.trim()) return;
      
      // Load existing searches
      const recentSearchesJson = await AsyncStorage.getItem('recentSearches');
      let searches = recentSearchesJson ? JSON.parse(recentSearchesJson) : [];
      
      // Remove if already exists (to move it to the top)
      searches = searches.filter(s => s.toLowerCase() !== term.toLowerCase());
      
      // Add to the beginning
      searches.unshift(term);
      
      // Limit to 10 recent searches
      if (searches.length > 10) {
        searches = searches.slice(0, 10);
      }
      
      // Save back to storage
      await AsyncStorage.setItem('recentSearches', JSON.stringify(searches));
      
      // Update state
      setRecentSearches(searches);
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };
  
  // Clear recent searches
  const clearRecentSearches = async () => {
    try {
      await AsyncStorage.removeItem('recentSearches');
      setRecentSearches([]);
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };
  
  // Effect to handle search when debounced term changes
  useEffect(() => {
    if (debouncedSearchTerm) {
      performSearch();
    } else {
      // Clear results when search term is cleared
      setPosts([]);
      setUsers([]);
      setConditions([]);
      setLastDoc(null);
      setHasMore(false);
    }
  }, [debouncedSearchTerm, searchMode, selectedCondition, sortBy, timeFilter]);
  
  // Perform search based on current parameters
  const performSearch = async (loadMore = false) => {
    if (!debouncedSearchTerm && !selectedCondition) return;
    
    setSearching(true);
    
    try {
      // Save to recent searches
      if (!loadMore && debouncedSearchTerm) {
        saveRecentSearch(debouncedSearchTerm);
      }
      
      // Clear existing results if not loading more
      if (!loadMore) {
        if (searchMode === 'users') {
          setUsers([]);
        } else if (searchMode === 'posts') {
          setPosts([]);
        } else if (searchMode === 'conditions') {
          setConditions([]);
        }
        
        setLastDoc(null);
      }
      
      switch (searchMode) {
        case 'users':
          await searchUsers(loadMore);
          break;
        case 'posts':
          await searchPosts(loadMore);
          break;
        case 'conditions':
          await searchConditions(loadMore);
          break;
      }
    } catch (error) {
      console.error('Error performing search:', error);
    } finally {
      setSearching(false);
    }
  };
  
  // Search for users
  const searchUsers = async (loadMore = false) => {
    // Get all users first, then filter client-side
    // This is a simplified approach. In a real app with many users,
    // you would need a more sophisticated search solution like Algolia
    
    try {
      let query = firestore().collection('users');
      
      // Apply condition filter if selected
      if (selectedCondition) {
        query = query.where('medicalConditions', 'array-contains', selectedCondition);
      }
      
      // Limit results
      query = query.limit(20);
      
      // Apply pagination
      if (loadMore && lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      
      // Extract user data
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // If search term provided, filter results client-side
      let filteredUsers = fetchedUsers;
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        filteredUsers = fetchedUsers.filter(user => 
          (user.firstName && user.firstName.toLowerCase().includes(searchLower)) ||
          (user.lastName && user.lastName.toLowerCase().includes(searchLower)) ||
          (user.email && user.email.toLowerCase().includes(searchLower)) ||
          (user.bio && user.bio.toLowerCase().includes(searchLower)) ||
          (user.medicalConditions && user.medicalConditions.some(condition => 
            condition.toLowerCase().includes(searchLower)
          ))
        );
      }
      
      // Set last document for pagination
      const lastVisible = snapshot.docs.length > 0 ? 
        snapshot.docs[snapshot.docs.length - 1] : null;
      
      setLastDoc(lastVisible);
      setHasMore(snapshot.docs.length === 20);
      
      // Update state
      setUsers(prevUsers => 
        loadMore ? [...prevUsers, ...filteredUsers] : filteredUsers
      );
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };
  
  // Search for posts
  const searchPosts = async (loadMore = false) => {
    try {
      // This is a simplified search approach. For production,
      // consider using Algolia or another search service for text search
      
      let query = firestore().collection('posts');
      
      // Apply condition filter if selected
      if (selectedCondition) {
        // First get users with this condition
        const usersSnapshot = await firestore()
          .collection('users')
          .where('medicalConditions', 'array-contains', selectedCondition)
          .get();
        
        const userIds = usersSnapshot.docs.map(doc => doc.id);
        
        // If no users found with this condition, return empty results
        if (userIds.length === 0) {
          setPosts([]);
          setLastDoc(null);
          setHasMore(false);
          return;
        }
        
        // Get posts from these users
        query = query.where('userId', 'in', userIds.slice(0, 10)); // Firestore limit
      }
      
      // Apply time filter
      if (timeFilter !== 'all') {
        const now = new Date();
        let filterDate = new Date();
        
        switch (timeFilter) {
          case 'today':
            filterDate.setDate(now.getDate() - 1);
            break;
          case 'week':
            filterDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            filterDate.setMonth(now.getMonth() - 1);
            break;
        }
        
        query = query.where('timestamp', '>=', filterDate);
      }
      
      // Apply sort
      switch (sortBy) {
        case 'recent':
          query = query.orderBy('timestamp', 'desc');
          break;
        case 'popular':
          query = query.orderBy('likeCount', 'desc');
          break;
        case 'relevant':
          // Sort by relevance would typically be handled by a search service
          // For this simplified implementation, just use recent
          query = query.orderBy('timestamp', 'desc');
          break;
      }
      
      // Limit results
      query = query.limit(10);
      
      // Apply pagination
      if (loadMore && lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snapshot = await query.get();
      
      // Extract post data
      let fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      }));
      
      // If search term provided, filter results client-side
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        fetchedPosts = fetchedPosts.filter(post => 
          (post.caption && post.caption.toLowerCase().includes(searchLower)) ||
          (post.userFullName && post.userFullName.toLowerCase().includes(searchLower))
        );
      }
      
      // Set last document for pagination
      const lastVisible = snapshot.docs.length > 0 ? 
        snapshot.docs[snapshot.docs.length - 1] : null;
      
      setLastDoc(lastVisible);
      setHasMore(snapshot.docs.length === 10);
      
      // Update state
      setPosts(prevPosts => 
        loadMore ? [...prevPosts, ...fetchedPosts] : fetchedPosts
      );
    } catch (error) {
      console.error('Error searching posts:', error);
    }
  };
  
  // Search for health conditions
  const searchConditions = async () => {
    try {
      // Get list of available conditions from posts and users
      const uniqueConditions = new Set();
      
      // Get conditions from users
      const usersSnapshot = await firestore()
        .collection('users')
        .limit(100) // Limit for performance
        .get();
      
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.medicalConditions && Array.isArray(userData.medicalConditions)) {
          userData.medicalConditions.forEach(condition => {
            uniqueConditions.add(condition);
          });
        }
      });
      
      // Convert to array
      let allConditions = Array.from(uniqueConditions);
      
      // If search term provided, filter conditions
      if (debouncedSearchTerm) {
        const searchLower = debouncedSearchTerm.toLowerCase();
        allConditions = allConditions.filter(condition =>
          condition.toLowerCase().includes(searchLower)
        );
      }
      
      // Sort alphabetically
      allConditions.sort();
      
      setConditions(allConditions);
      setHasMore(false);
    } catch (error) {
      console.error('Error searching conditions:', error);
    }
  };
  
  // Load more results on scroll end
  const handleLoadMore = () => {
    if (hasMore && !searching) {
      performSearch(true);
    }
  };
  
  // Render search results based on mode
  const renderSearchResults = () => {
    if (searching && !loadMore) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
            Searching...
          </Text>
        </View>
      );
    }
    
    if (searchMode === 'users') {
      if (users.length === 0 && debouncedSearchTerm) {
        return renderEmptyResults();
      }
      
      return (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <UserListItem
              user={item}
              currentUserConditions={userData?.medicalConditions || []}
              onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            searching && hasMore ? (
              <ActivityIndicator 
                size="small" 
                color={theme.colors.primary.main} 
                style={styles.footerLoader}
              />
            ) : null
          }
        />
      );
    } else if (searchMode === 'posts') {
      if (posts.length === 0 && debouncedSearchTerm) {
        return renderEmptyResults();
      }
      
      return (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              navigation={navigation}
              onCommentPress={() => navigation.navigate('Comments', { 
                postId: item.id,
                title: 'Comments'
              })}
              onProfilePress={() => {
                if (item.userId === auth().currentUser.uid) {
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
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            searching && hasMore ? (
              <ActivityIndicator 
                size="small" 
                color={theme.colors.primary.main} 
                style={styles.footerLoader}
              />
            ) : null
          }
        />
      );
    } else if (searchMode === 'conditions') {
      if (conditions.length === 0 && debouncedSearchTerm) {
        return renderEmptyResults();
      }
      
      return (
        <FlatList
          data={conditions}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.conditionItem}
              onPress={() => {
                navigation.navigate('ExploreTab', {
                  screen: 'Explore',
                  params: { condition: item }
                });
              }}
            >
              <View style={styles.conditionIconContainer}>
                <Icon name="fitness-outline" size={24} color={theme.colors.primary.main} />
              </View>
              <View style={styles.conditionContent}>
                <Text style={[styles.conditionName, { color: theme.colors.text.primary }]}>
                  {item}
                </Text>
                <Text style={[styles.conditionMeta, { color: theme.colors.text.secondary }]}>
                  Health Condition
                </Text>
              </View>
              <Icon name="chevron-forward" size={20} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      );
    }
    
    // If no search term yet, show recent searches
    if (!debouncedSearchTerm) {
      return renderRecentSearches();
    }
    
    return null;
  };
  
  // Render empty results view
  const renderEmptyResults = () => {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="search-outline" size={64} color={theme.colors.gray[300]} />
        <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
          No results found
        </Text>
        <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
          We couldn't find any results for "{debouncedSearchTerm}"
        </Text>
        {searchMode !== 'conditions' && (
          <TouchableOpacity
            style={[styles.tryButton, { backgroundColor: theme.colors.primary.lightest }]}
            onPress={() => {
              setSearchMode(searchMode === 'users' ? 'posts' : 'users');
            }}
          >
            <Text style={[styles.tryButtonText, { color: theme.colors.primary.main }]}>
              Try searching for {searchMode === 'users' ? 'posts' : 'users'} instead
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };
  
  // Render recent searches
  const renderRecentSearches = () => {
    if (recentSearches.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="search-outline" size={64} color={theme.colors.gray[300]} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
            Search {searchMode}
          </Text>
          <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
            Enter a search term to find {searchMode}
          </Text>
        </View>
      );
    }
    
    return (
      <View style={styles.recentContainer}>
        <View style={styles.recentHeader}>
          <Text style={[styles.recentTitle, { color: theme.colors.text.primary }]}>
            Recent Searches
          </Text>
          <TouchableOpacity onPress={clearRecentSearches}>
            <Text style={[styles.clearText, { color: theme.colors.primary.main }]}>
              Clear All
            </Text>
          </TouchableOpacity>
        </View>
        
        {recentSearches.map((search, index) => (
          <TouchableOpacity
            key={index}
            style={styles.recentItem}
            onPress={() => setSearchTerm(search)}
          >
            <Icon name="time-outline" size={20} color={theme.colors.text.secondary} />
            <Text style={[styles.recentText, { color: theme.colors.text.primary }]}>
              {search}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const updatedSearches = [...recentSearches];
                updatedSearches.splice(index, 1);
                setRecentSearches(updatedSearches);
                AsyncStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
              }}
            >
              <Icon name="close" size={20} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  // Render filter options
  const renderFilterOptions = () => {
    return (
      <View style={[styles.filtersContainer, { backgroundColor: theme.colors.background.paper }]}>
        <View style={styles.filterSection}>
          <Text style={[styles.filterTitle, { color: theme.colors.text.primary }]}>
            Sort By
          </Text>
          <View style={styles.filterOptions}>
            <TouchableOpacity
              style={[
                styles.filterOption,
                sortBy === 'recent' && [
                  styles.activeFilterOption,
                  { backgroundColor: theme.colors.primary.lightest }
                ],
              ]}
              onPress={() => setSortBy('recent')}
            >
              <Text style={[
                styles.filterOptionText,
                sortBy === 'recent' && [
                  styles.activeFilterOptionText,
                  { color: theme.colors.primary.main }
                ],
                { color: theme.colors.text.primary }
              ]}>
                Recent
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterOption,
                sortBy === 'popular' && [
                  styles.activeFilterOption,
                  { backgroundColor: theme.colors.primary.lightest }
                ],
              ]}
              onPress={() => setSortBy('popular')}
            >
              <Text style={[
                styles.filterOptionText,
                sortBy === 'popular' && [
                  styles.activeFilterOptionText,
                  { color: theme.colors.primary.main }
                ],
                { color: theme.colors.text.primary }
              ]}>
                Popular
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterOption,
                sortBy === 'relevant' && [
                  styles.activeFilterOption,
                  { backgroundColor: theme.colors.primary.lightest }
                ],
              ]}
              onPress={() => setSortBy('relevant')}
            >
              <Text style={[
                styles.filterOptionText,
                sortBy === 'relevant' && [
                  styles.activeFilterOptionText,
                  { color: theme.colors.primary.main }
                ],
                { color: theme.colors.text.primary }
              ]}>
                Relevant
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.filterSection}>
          <Text style={[styles.filterTitle, { color: theme.colors.text.primary }]}>
            Time Frame
          </Text>
          <View style={styles.filterOptions}>
            <TouchableOpacity
              style={[
                styles.filterOption,
                timeFilter === 'all' && [
                  styles.activeFilterOption,
                  { backgroundColor: theme.colors.primary.lightest }
                ],
              ]}
              onPress={() => setTimeFilter('all')}
            >
              <Text style={[
                styles.filterOptionText,
                timeFilter === 'all' && [
                  styles.activeFilterOptionText,
                  { color: theme.colors.primary.main }
                ],
                { color: theme.colors.text.primary }
              ]}>
                All Time
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterOption,
                timeFilter === 'today' && [
                  styles.activeFilterOption,
                  { backgroundColor: theme.colors.primary.lightest }
                ],
              ]}
              onPress={() => setTimeFilter('today')}
            >
              <Text style={[
                styles.filterOptionText,
                timeFilter === 'today' && [
                  styles.activeFilterOptionText,
                  { color: theme.colors.primary.main }
                ],
                { color: theme.colors.text.primary }
              ]}>
                Today
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterOption,
                timeFilter === 'week' && [
                  styles.activeFilterOption,
                  { backgroundColor: theme.colors.primary.lightest }
                ],
              ]}
              onPress={() => setTimeFilter('week')}
            >
              <Text style={[
                styles.filterOptionText,
                timeFilter === 'week' && [
                  styles.activeFilterOptionText,
                  { color: theme.colors.primary.main }
                ],
                { color: theme.colors.text.primary }
              ]}>
                This Week
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterOption,
                timeFilter === 'month' && [
                  styles.activeFilterOption,
                  { backgroundColor: theme.colors.primary.lightest }
                ],
              ]}
              onPress={() => setTimeFilter('month')}
            >
              <Text style={[
                styles.filterOptionText,
                timeFilter === 'month' && [
                  styles.activeFilterOptionText,
                  { color: theme.colors.primary.main }
                ],
                { color: theme.colors.text.primary }
              ]}>
                This Month
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {searchMode === 'posts' && (
          <View style={styles.filterSection}>
            <Text style={[styles.filterTitle, { color: theme.colors.text.primary }]}>
              Health Condition
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.conditionsScroll}
            >
              <TouchableOpacity
                style={[
                  styles.conditionFilterOption,
                  !selectedCondition && [
                    styles.activeConditionFilterOption,
                    { backgroundColor: theme.colors.primary.lightest }
                  ],
                ]}
                onPress={() => setSelectedCondition(null)}
              >
                <Text style={[
                  styles.conditionFilterText,
                  !selectedCondition && [
                    styles.activeConditionFilterText,
                    { color: theme.colors.primary.main }
                  ],
                  { color: theme.colors.text.primary }
                ]}>
                  All Conditions
                </Text>
              </TouchableOpacity>
              
              {userData?.medicalConditions?.map((condition) => (
                <TouchableOpacity
                  key={condition}
                  style={[
                    styles.conditionFilterOption,
                    selectedCondition === condition && [
                      styles.activeConditionFilterOption,
                      { backgroundColor: theme.colors.primary.lightest }
                    ],
                  ]}
                  onPress={() => setSelectedCondition(
                    selectedCondition === condition ? null : condition
                  )}
                >
                  <Text style={[
                    styles.conditionFilterText,
                    selectedCondition === condition && [
                      styles.activeConditionFilterText,
                      { color: theme.colors.primary.main }
                    ],
                    { color: theme.colors.text.primary }
                  ]}>
                    {condition}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.default }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.background.paper }]}>
        <View style={styles.searchContainer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          
          <View style={[
            styles.searchInputContainer,
            { backgroundColor: theme.colors.background.input }
          ]}>
            <Icon name="search" size={20} color={theme.colors.text.secondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text.primary }]}
              placeholder="Search..."
              placeholderTextColor={theme.colors.text.hint}
              value={searchTerm}
              onChangeText={setSearchTerm}
              returnKeyType="search"
              autoFocus
              onSubmitEditing={() => {
                Keyboard.dismiss();
                if (searchTerm.trim()) {
                  performSearch();
                }
              }}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <Icon name="close-circle" size={20} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Icon 
              name="options-outline" 
              size={24} 
              color={
                showFilters || selectedCondition || sortBy !== 'recent' || timeFilter !== 'all'
                  ? theme.colors.primary.main
                  : theme.colors.text.secondary
              } 
            />
          </TouchableOpacity>
        </View>
        
        <SegmentedControl
          values={['Users', 'Posts', 'Conditions']}
          selectedIndex={
            searchMode === 'users' ? 0 : searchMode === 'posts' ? 1 : 2
          }
          onChange={(index) => {
            setSearchMode(
              index === 0 ? 'users' : index === 1 ? 'posts' : 'conditions'
            );
          }}
          style={styles.segmentedControl}
        />
        
        {showFilters && renderFilterOptions()}
      </View>
      
      <View style={styles.content}>
        {renderSearchResults()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  backButton: {
    marginRight: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 8,
    fontSize: 16,
  },
  filterButton: {
    marginLeft: 12,
    padding: 4,
  },
  segmentedControl: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  filtersContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  activeFilterOption: {
    borderColor: 'transparent',
  },
  filterOptionText: {
    fontSize: 14,
  },
  activeFilterOptionText: {
    fontWeight: 'bold',
  },
  conditionsScroll: {
    paddingRight: 16,
    paddingBottom: 8,
  },
  conditionFilterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  activeConditionFilterOption: {
    borderColor: 'transparent',
  },
  conditionFilterText: {
    fontSize: 14,
  },
  activeConditionFilterText: {
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  footerLoader: {
    padding: 20,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  tryButton: {
    padding: 12,
    borderRadius: 8,
  },
  tryButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  recentContainer: {
    padding: 16,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearText: {
    fontSize: 14,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  recentText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  conditionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conditionContent: {
    flex: 1,
  },
  conditionName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  conditionMeta: {
    fontSize: 14,
  },
});

// src/components/SegmentedControl.js
// Custom segmented control component

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const SegmentedControl = ({
  values = [],
  selectedIndex = 0,
  onChange,
  style,
}) => {
  const { theme } = useTheme();
  const [segmentWidth, setSegmentWidth] = React.useState(0);
  const translateX = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    // Animate the selection indicator when selected index changes
    Animated.timing(translateX, {
      toValue: selectedIndex * segmentWidth,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [selectedIndex, segmentWidth, translateX]);
  
  // When layout changes, recalculate segment width
  const onLayout = event => {
    const { width } = event.nativeEvent.layout;
    const newSegmentWidth = values.length > 0 ? width / values.length : 0;
    setSegmentWidth(newSegmentWidth);
  };
  
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.input },
        style,
      ]}
      onLayout={onLayout}
    >
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.selectedIndicator,
            {
              backgroundColor: theme.colors.background.paper,
              width: segmentWidth,
              transform: [{ translateX }],
              borderColor: theme.colors.primary.main,
            },
          ]}
        />
      )}
      
      {values.map((value, index) => (
        <TouchableOpacity
          key={index}
          style={styles.segment}
          onPress={() => onChange(index)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.segmentText,
              {
                color:
                  selectedIndex === index
                    ? theme.colors.primary.main
                    : theme.colors.text.secondary,
                fontWeight: selectedIndex === index ? 'bold' : 'normal',
              },
            ]}
          >
            {value}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontSize: 14,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 2,
    left: 2,
    bottom: 2,
    borderRadius: 18,
    borderWidth: 1,
    zIndex: 0,
  },
});

export default SegmentedControl;
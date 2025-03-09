// src/screens/ExploreScreen.js
// Screen for discovering other users with similar conditions

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';
import { useUser } from '../contexts/UserContext';
import UserListItem from '../components/UserListItem';

const ExploreScreen = ({ navigation }) => {
  const { userData } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendedUsers, setRecommendedUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCondition, setSelectedCondition] = useState(null);

  useEffect(() => {
    fetchRecommendedUsers();
  }, [userData]);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, recommendedUsers, selectedCondition]);

  const fetchRecommendedUsers = async () => {
    if (!userData || !userData.medicalConditions || userData.medicalConditions.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Find users who share any of the current user's medical conditions
      const usersSnapshot = await firestore()
        .collection('users')
        .where('medicalConditions', 'array-contains-any', userData.medicalConditions)
        .limit(50)
        .get();

      let users = usersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(user => user.id !== auth().currentUser.uid); // Filter out current user

      // Sort by number of shared conditions (descending)
      users.sort((a, b) => {
        const sharedWithA = a.medicalConditions.filter(condition => 
          userData.medicalConditions.includes(condition)
        ).length;
        
        const sharedWithB = b.medicalConditions.filter(condition => 
          userData.medicalConditions.includes(condition)
        ).length;
        
        return sharedWithB - sharedWithA;
      });

      setRecommendedUsers(users);
      setFilteredUsers(users);
    } catch (error) {
      console.error('Error fetching recommended users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = recommendedUsers;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.firstName.toLowerCase().includes(query) ||
        user.lastName.toLowerCase().includes(query) ||
        user.medicalConditions.some(condition => condition.toLowerCase().includes(query))
      );
    }

    if (selectedCondition) {
      filtered = filtered.filter(user =>
        user.medicalConditions.includes(selectedCondition)
      );
    }

    setFilteredUsers(filtered);
  };

  const handleConditionSelect = (condition) => {
    if (selectedCondition === condition) {
      setSelectedCondition(null);
    } else {
      setSelectedCondition(condition);
    }
  };

  // Get unique conditions from all recommended users
  const getUniqueConditions = () => {
    if (!userData || !userData.medicalConditions) return [];
    
    return userData.medicalConditions.filter(condition => 
      recommendedUsers.some(user => user.medicalConditions.includes(condition))
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#546E7A" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people or conditions"
          placeholderTextColor="#90A4AE"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={20} color="#546E7A" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Filter by Condition</Text>
      
      <FlatList
        horizontal
        data={getUniqueConditions()}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.conditionsContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.conditionItem,
              selectedCondition === item && styles.selectedConditionItem
            ]}
            onPress={() => handleConditionSelect(item)}
          >
            <Text
              style={[
                styles.conditionText,
                selectedCondition === item && styles.selectedConditionText
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />
      
      <Text style={styles.resultTitle}>
        {selectedCondition 
          ? `People with ${selectedCondition}`
          : 'People with similar conditions'}
      </Text>
    </View>
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon name="people-outline" size={60} color="#B0BEC5" />
      <Text style={styles.emptyTitle}>
        {searchQuery
          ? 'No results found'
          : 'No recommendations available'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? 'Try different search terms or filters'
          : 'Update your profile with more medical conditions to get better recommendations'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Finding people for you...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={
            filteredUsers.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
          }
          renderItem={({ item }) => (
            <UserListItem
              user={item}
              currentUserConditions={userData.medicalConditions}
              onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#546E7A',
    fontSize: 16,
  },
  header: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#263238',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 10,
  },
  conditionsContainer: {
    paddingBottom: 16,
  },
  conditionItem: {
    backgroundColor: '#E3F2FD',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  selectedConditionItem: {
    backgroundColor: '#2196F3',
  },
  conditionText: {
    color: '#2196F3',
    fontSize: 14,
  },
  selectedConditionText: {
    color: 'white',
    fontWeight: 'bold',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#263238',
    marginTop: 10,
    marginBottom: 16,
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
    color: '#455A64',
    marginTop: 15,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#78909C',
    textAlign: 'center',
    marginTop: 5,
  },
});

export default ExploreScreen;

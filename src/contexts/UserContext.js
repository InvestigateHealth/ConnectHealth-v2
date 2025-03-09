// src/contexts/UserContext.js
// Context for managing user data and authentication state

import React, { createContext, useState, useContext, useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { BlockService } from '../services/FirebaseService';

// Create the context
const UserContext = createContext({
  user: null,
  userData: null,
  loading: true,
  blockedUsers: [],
  setUser: () => {},
  setUserData: () => {},
  updateUserData: async () => {},
  isUserBlocked: () => false,
  blockUser: async () => false,
  unblockUser: async () => false,
});

// Provider component
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [initializing, setInitializing] = useState(true);

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      
      if (!firebaseUser) {
        // User is signed out
        setUserData(null);
        setBlockedUsers([]);
        setLoading(false);
        setInitializing(false);
      }
    });

    // Cleanup subscription
    return unsubscribe;
  }, []);

  // Fetch user data when auth state changes
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Check if we have cached data first for immediate UI update
        try {
          const cachedUserData = await AsyncStorage.getItem(`user_${user.uid}`);
          if (cachedUserData) {
            const parsedData = JSON.parse(cachedUserData);
            setUserData(parsedData);
          }
        } catch (cacheError) {
          console.error('Error loading cached user data:', cacheError);
        }
        
        // Get user document from Firestore
        const userDoc = await firestore().collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
          // Update with fresh data
          const freshUserData = userDoc.data();
          setUserData(freshUserData);
          
          // Update cache
          await AsyncStorage.setItem(`user_${user.uid}`, JSON.stringify({
            ...freshUserData,
            _cachedAt: Date.now()
          }));
        } else {
          // Create user document if it doesn't exist (e.g., first sign-in after registration)
          const newUserData = {
            id: user.uid,
            email: user.email,
            firstName: user.displayName ? user.displayName.split(' ')[0] : '',
            lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
            profileImageURL: user.photoURL || null,
            joinDate: firestore.FieldValue.serverTimestamp(),
            createdAt: firestore.FieldValue.serverTimestamp(),
          };
          
          await firestore().collection('users').doc(user.uid).set(newUserData);
          setUserData(newUserData);
          
          // Cache the new user data
          await AsyncStorage.setItem(`user_${user.uid}`, JSON.stringify({
            ...newUserData,
            _cachedAt: Date.now()
          }));
        }
        
        // Fetch blocked users
        await fetchBlockedUsers();
      } catch (error) {
        console.error('Error fetching user data:', error);
        Alert.alert(
          'Error',
          'Failed to load your profile. Please try again later.'
        );
      } finally {
        setLoading(false);
        setInitializing(false);
      }
    };

    if (user) {
      fetchUserData();
    }
  }, [user]);

  // Fetch blocked users list
  const fetchBlockedUsers = async () => {
    if (!user) return;
    
    try {
      const blockedSnapshot = await firestore()
        .collection('blocks')
        .where('userId', '==', user.uid)
        .get();
      
      const blockList = blockedSnapshot.docs.map(doc => doc.data().blockedUserId);
      setBlockedUsers(blockList);
      
      // Cache the blocked users list
      await AsyncStorage.setItem(`blockedUsers_${user.uid}`, JSON.stringify(blockList));
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    }
  };

  // Update user data
  const updateUserData = async (updates) => {
    if (!user) throw new Error('No authenticated user');
    
    // Update in Firestore
    await firestore()
      .collection('users')
      .doc(user.uid)
      .update({
        ...updates,
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
    
    // Update local state
    setUserData(prev => ({ ...prev, ...updates }));
    
    // Update cache
    try {
      const cachedUserData = await AsyncStorage.getItem(`user_${user.uid}`);
      if (cachedUserData) {
        const parsedData = JSON.parse(cachedUserData);
        await AsyncStorage.setItem(`user_${user.uid}`, JSON.stringify({
          ...parsedData,
          ...updates,
          _cachedAt: Date.now()
        }));
      }
    } catch (cacheError) {
      console.error('Error updating cached user data:', cacheError);
    }
    
    return true;
  };

  // Check if a user is blocked
  const isUserBlocked = (userId) => {
    return blockedUsers.includes(userId);
  };

  // Block a user
  const blockUser = async (userId, reason = '') => {
    if (!user) throw new Error('No authenticated user');
    
    try {
      // Call the BlockService
      const success = await BlockService.blockUser(user.uid, userId, reason);
      
      if (success) {
        // Update local state
        setBlockedUsers(prev => [...prev, userId]);
        
        // Update cache
        try {
          await AsyncStorage.setItem(`blockedUsers_${user.uid}`, JSON.stringify([...blockedUsers, userId]));
        } catch (cacheError) {
          console.error('Error updating cached blocked users:', cacheError);
        }
      }
      
      return success;
    } catch (error) {
      console.error('Error blocking user:', error);
      Alert.alert(
        'Error',
        'Failed to block user. Please try again later.'
      );
      return false;
    }
  };

  // Unblock a user
  const unblockUser = async (userId) => {
    if (!user) throw new Error('No authenticated user');
    
    try {
      // Call the BlockService
      const success = await BlockService.unblockUser(user.uid, userId);
      
      if (success) {
        // Update local state
        setBlockedUsers(prev => prev.filter(id => id !== userId));
        
        // Update cache
        try {
          await AsyncStorage.setItem(
            `blockedUsers_${user.uid}`, 
            JSON.stringify(blockedUsers.filter(id => id !== userId))
          );
        } catch (cacheError) {
          console.error('Error updating cached blocked users:', cacheError);
        }
      }
      
      return success;
    } catch (error) {
      console.error('Error unblocking user:', error);
      Alert.alert(
        'Error',
        'Failed to unblock user. Please try again later.'
      );
      return false;
    }
  };

  // Context value
  const value = {
    user,
    userData,
    loading: loading || initializing,
    blockedUsers,
    setUser,
    setUserData,
    updateUserData,
    isUserBlocked,
    blockUser,
    unblockUser,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

// Hook for using the user context
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

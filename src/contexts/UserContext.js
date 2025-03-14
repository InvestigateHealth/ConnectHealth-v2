// src/contexts/UserContext.js
// Context provider for user authentication and data

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsService } from '../services/AnalyticsService';

// Create context
const UserContext = createContext();

// Context provider component
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (authUser) => {
      setUser(authUser);
      
      if (authUser) {
        try {
          // Try to get cached data first
          const cachedData = await AsyncStorage.getItem(`user_${authUser.uid}`);
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            setUserData(parsedData);
          }
          
          // Fetch fresh user data
          const userDoc = await firestore().collection('users').doc(authUser.uid).get();
          
          if (userDoc.exists) {
            const freshUserData = userDoc.data();
            setUserData(freshUserData);
            
            // Update cache
            await AsyncStorage.setItem(`user_${authUser.uid}`, JSON.stringify({
              ...freshUserData,
              _cachedAt: Date.now()
            }));
          } else {
            // Create user document if it doesn't exist
            const newUserData = {
              id: authUser.uid,
              email: authUser.email,
              firstName: authUser.displayName?.split(' ')[0] || '',
              lastName: authUser.displayName?.split(' ').slice(1).join(' ') || '',
              profileImageURL: authUser.photoURL || null,
              joinDate: firestore.FieldValue.serverTimestamp(),
              createdAt: firestore.FieldValue.serverTimestamp(),
              updatedAt: firestore.FieldValue.serverTimestamp()
            };
            
            await firestore().collection('users').doc(authUser.uid).set(newUserData);
            setUserData(newUserData);
            
            // Update cache
            await AsyncStorage.setItem(`user_${authUser.uid}`, JSON.stringify({
              ...newUserData,
              _cachedAt: Date.now()
            }));
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);
  
  // Update user data in Firestore
  const updateUserData = async (newData) => {
    if (!user) return false;
    
    try {
      const userRef = firestore().collection('users').doc(user.uid);
      
      await userRef.update({
        ...newData,
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
      
      // Update local state
      setUserData(prev => ({
        ...prev,
        ...newData
      }));
      
      // Update cache
      const cachedData = await AsyncStorage.getItem(`user_${user.uid}`);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        await AsyncStorage.setItem(`user_${user.uid}`, JSON.stringify({
          ...parsedData,
          ...newData,
          _cachedAt: Date.now()
        }));
      }
      
      // Log analytics event
      AnalyticsService.logEvent('user_profile_updated', {
        fields_updated: Object.keys(newData)
      });
      
      return true;
    } catch (error) {
      console.error('Error updating user data:', error);
      return false;
    }
  };
  
  const value = {
    user,
    userData,
    setUser,
    setUserData,
    loading,
    updateUserData
  };
  
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

// Custom hook to use the user context
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;
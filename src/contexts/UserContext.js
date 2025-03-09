// src/contexts/UserContext.js
// Context for user data management

import React, { createContext, useState, useContext, useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Create context
const UserContext = createContext();

// Provider component
export const UserProvider = ({ children }) => {
  // State for user authentication and profile data
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Effect to set initial loading state based on auth
  useEffect(() => {
    // If we have explicitly set both user and userData states, we're no longer loading
    if (user !== null && userData !== null) {
      setLoading(false);
    }
    
    // If user is null but we've explicitly checked for it, we're also done loading
    if (user === null && userData === null) {
      setLoading(false);
    }
  }, [user, userData]);

  // Update user profile data
  const updateUserData = async (data) => {
    if (!user) return false;
    
    try {
      // Update Firestore
      await firestore().collection('users').doc(user.uid).update({
        ...data,
        lastUpdated: firestore.FieldValue.serverTimestamp()
      });
      
      // Update local state
      setUserData(currentData => ({
        ...currentData,
        ...data
      }));
      
      return true;
    } catch (error) {
      console.error('Error updating user data:', error);
      return false;
    }
  };

  // Refresh user data from Firestore
  const refreshUserData = async () => {
    if (!user) return false;
    
    try {
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      
      if (userDoc.exists) {
        setUserData(userDoc.data());
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing user data:', error);
      return false;
    }
  };

  // Get a user's profile by their ID
  const getUserProfile = async (userId) => {
    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        return {
          id: userId,
          ...userDoc.data()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  };

  // Context value
  const contextValue = {
    user,
    setUser,
    userData,
    setUserData,
    loading,
    updateUserData,
    refreshUserData,
    getUserProfile
  };

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
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

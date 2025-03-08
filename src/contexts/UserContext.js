// src/contexts/UserContext.js
// Enhanced User Context with comprehensive state management - Updated with proper Firebase integration

import React, { createContext, useContext, useState, useEffect, useCallback, useReducer } from 'react';
import { Alert } from 'react-native';
import { 
  AuthService,
  UserService,
  BlockService 
} from '../services/FirebaseService';

// Define initial state
const initialState = {
  user: null,
  userData: null,
  blockedUsers: [],
  loading: true,
  error: null
};

// Action types
const actions = {
  SET_USER: 'SET_USER',
  SET_USER_DATA: 'SET_USER_DATA',
  SET_BLOCKED_USERS: 'SET_BLOCKED_USERS',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  RESET_STATE: 'RESET_STATE',
  ADD_BLOCKED_USER: 'ADD_BLOCKED_USER',
  REMOVE_BLOCKED_USER: 'REMOVE_BLOCKED_USER'
};

// Reducer function
const userReducer = (state, action) => {
  switch (action.type) {
    case actions.SET_USER:
      return { ...state, user: action.payload };
    case actions.SET_USER_DATA:
      return { ...state, userData: action.payload };
    case actions.SET_BLOCKED_USERS:
      return { ...state, blockedUsers: action.payload };
    case actions.SET_LOADING:
      return { ...state, loading: action.payload };
    case actions.SET_ERROR:
      return { ...state, error: action.payload };
    case actions.RESET_STATE:
      return { ...initialState, loading: false };
    case actions.ADD_BLOCKED_USER:
      return { 
        ...state, 
        blockedUsers: [...state.blockedUsers, action.payload] 
      };
    case actions.REMOVE_BLOCKED_USER:
      return { 
        ...state, 
        blockedUsers: state.blockedUsers.filter(id => id !== action.payload) 
      };
    default:
      return state;
  }
};

// Create context
const UserContext = createContext(null);

/**
 * UserProvider component for authentication and user data
 */
export const UserProvider = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, initialState);
  const [listeners, setListeners] = useState([]);

  // Handle authentication state changes
  useEffect(() => {
    const unsubscribeAuth = AuthService.onAuthStateChanged(async (authUser) => {
      dispatch({ type: actions.SET_USER, payload: authUser });
      
      if (authUser) {
        // User is signed in, fetch user data
        fetchUserData(authUser.uid);
        fetchBlockedUsers(authUser.uid);
      } else {
        // User is signed out
        dispatch({ type: actions.RESET_STATE });
      }
    });
    
    // Add to listeners
    setListeners(prev => [...prev, unsubscribeAuth]);
    
    // Cleanup on unmount
    return () => {
      unsubscribeAuth();
    };
  }, []);
  
  // Clean up all listeners on unmount
  useEffect(() => {
    return () => {
      listeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [listeners]);

  /**
   * Fetch user data from database
   * 
   * @param {string} userId - User ID
   */
  const fetchUserData = async (userId) => {
    try {
      dispatch({ type: actions.SET_LOADING, payload: true });
      
      // Set up real-time listener for user data using UserService
      const unsubscribeUser = await UserService.onUserDataChange(
        userId,
        (userData) => {
          if (userData) {
            dispatch({ 
              type: actions.SET_USER_DATA, 
              payload: userData
            });
          } else {
            // User document doesn't exist, create it
            createUserDocument(userId);
          }
          dispatch({ type: actions.SET_LOADING, payload: false });
        },
        (error) => {
          console.error('Error fetching user data:', error);
          dispatch({ type: actions.SET_ERROR, payload: error.message });
          dispatch({ type: actions.SET_LOADING, payload: false });
        }
      );
      
      // Add to listeners
      setListeners(prev => [...prev, unsubscribeUser]);
    } catch (error) {
      console.error('Error setting up user data listener:', error);
      dispatch({ type: actions.SET_ERROR, payload: error.message });
      dispatch({ type: actions.SET_LOADING, payload: false });
    }
  };

  /**
   * Create user document if it doesn't exist
   * 
   * @param {string} userId - User ID
   */
  const createUserDocument = async (userId) => {
    try {
      const user = AuthService.getCurrentUser();
      
      if (!user) return;
      
      // Create the user document with basic info
      await UserService.createUserProfile(userId, {
        email: user.email,
        firstName: user.displayName ? user.displayName.split(' ')[0] : '',
        lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
        medicalConditions: [],
        profileImageURL: user.photoURL || null,
        joinDate: new Date()
      });
      
      // Alert the user to complete their profile
      Alert.alert(
        'Welcome to HealthConnect',
        'Please complete your profile to get the most out of the app.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error creating user document:', error);
      dispatch({ type: actions.SET_ERROR, payload: error.message });
    }
  };

  /**
   * Fetch blocked users list
   * 
   * @param {string} userId - User ID
   */
  const fetchBlockedUsers = async (userId) => {
    try {
      // Set up real-time listener for blocked users
      const unsubscribeBlocked = await BlockService.onBlockedUsersChange(
        userId,
        (blockedIds) => {
          dispatch({ type: actions.SET_BLOCKED_USERS, payload: blockedIds });
        },
        (error) => {
          console.error('Error fetching blocked users:', error);
        }
      );
      
      // Add to listeners
      setListeners(prev => [...prev, unsubscribeBlocked]);
    } catch (error) {
      console.error('Error setting up blocked users listener:', error);
    }
  };

  /**
   * Update user profile data
   * 
   * @param {Object} data - User data to update
   * @returns {Promise<void>}
   */
  const updateUserData = async (data) => {
    if (!state.user) return Promise.reject(new Error('Not authenticated'));
    
    try {
      await UserService.updateProfile(state.user.uid, data);
      return Promise.resolve();
    } catch (error) {
      console.error('Error updating user data:', error);
      return Promise.reject(error);
    }
  };

  /**
   * Block a user
   * 
   * @param {string} userIdToBlock - User ID to block
   * @param {string} reason - Optional reason for blocking
   * @returns {Promise<boolean>} Success status
   */
  const blockUser = async (userIdToBlock, reason = '') => {
    if (!state.user) return false;
    
    try {
      await BlockService.blockUser(state.user.uid, userIdToBlock, reason);
      
      // Optimistically update state
      dispatch({ type: actions.ADD_BLOCKED_USER, payload: userIdToBlock });
      return true;
    } catch (error) {
      console.error('Error blocking user:', error);
      return false;
    }
  };

  /**
   * Unblock a user
   * 
   * @param {string} userIdToUnblock - User ID to unblock
   * @returns {Promise<boolean>} Success status
   */
  const unblockUser = async (userIdToUnblock) => {
    if (!state.user) return false;
    
    try {
      await BlockService.unblockUser(state.user.uid, userIdToUnblock);
      
      // Optimistically update state
      dispatch({ type: actions.REMOVE_BLOCKED_USER, payload: userIdToUnblock });
      return true;
    } catch (error) {
      console.error('Error unblocking user:', error);
      return false;
    }
  };

  /**
   * Check if a user is blocked
   * 
   * @param {string} userId - User ID to check
   * @returns {boolean} Whether the user is blocked
   */
  const isUserBlocked = useCallback((userId) => {
    return state.blockedUsers.includes(userId);
  }, [state.blockedUsers]);

  /**
   * Sign out the current user
   */
  const signOut = async () => {
    try {
      await AuthService.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  // Context value
  const value = {
    ...state,
    updateUserData,
    blockUser,
    unblockUser,
    isUserBlocked,
    signOut,
    refreshBlockedUsers: () => {
      if (state.user) {
        fetchBlockedUsers(state.user.uid);
      }
    }
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

/**
 * Hook to access user context
 */
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

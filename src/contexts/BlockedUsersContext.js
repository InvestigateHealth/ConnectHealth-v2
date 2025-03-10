// src/contexts/BlockedUsersContext.js
// Context provider for managing blocked users

import React, { createContext, useState, useEffect, useContext } from 'react';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from './UserContext';
import { useNetwork } from './NetworkContext';
import { AnalyticsService } from '../services/AnalyticsService';

const BlockedUsersContext = createContext();

export const useBlockedUsers = () => useContext(BlockedUsersContext);

export const BlockedUsersProvider = ({ children }) => {
  const { user } = useUser();
  const { isConnected } = useNetwork();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedByUsers, setBlockedByUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unsubscribeListener, setUnsubscribeListener] = useState(null);
  
  // Load and sync blocked users
  useEffect(() => {
    if (!user) {
      setBlockedUsers([]);
      setBlockedByUsers([]);
      setLoading(false);
      return;
    }
    
    const loadBlockedUsers = async () => {
      setLoading(true);
      
      try {
        // First try to load from cache for immediate UI update
        const cachedBlockedUsers = await AsyncStorage.getItem(`blocked_users_${user.uid}`);
        if (cachedBlockedUsers) {
          setBlockedUsers(JSON.parse(cachedBlockedUsers));
        }
        
        const cachedBlockedByUsers = await AsyncStorage.getItem(`blocked_by_users_${user.uid}`);
        if (cachedBlockedByUsers) {
          setBlockedByUsers(JSON.parse(cachedBlockedByUsers));
        }
        
        // Then fetch fresh data from Firestore if online
        if (isConnected) {
          // Get users that this user has blocked
          const blockedDoc = await firestore().collection('userRelations').doc(user.uid).get();
          
          if (blockedDoc.exists && blockedDoc.data().blockedUsers) {
            const blockedUsersList = blockedDoc.data().blockedUsers || [];
            setBlockedUsers(blockedUsersList);
            await AsyncStorage.setItem(`blocked_users_${user.uid}`, JSON.stringify(blockedUsersList));
          } else if (!blockedDoc.exists) {
            // Create the document if it doesn't exist
            await firestore().collection('userRelations').doc(user.uid).set({
              blockedUsers: [],
              lastUpdated: firestore.FieldValue.serverTimestamp()
            });
          }
          
          // Get users who have blocked this user (for content filtering)
          const blockedByQuerySnapshot = await firestore()
            .collection('userRelations')
            .where('blockedUsers', 'array-contains', user.uid)
            .get();
          
          const blockedByList = blockedByQuerySnapshot.docs.map(doc => doc.id);
          setBlockedByUsers(blockedByList);
          await AsyncStorage.setItem(`blocked_by_users_${user.uid}`, JSON.stringify(blockedByList));
        }
      } catch (error) {
        console.error('Error loading blocked users:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadBlockedUsers();
    
    // Clean up existing listener if it exists
    if (unsubscribeListener) {
      unsubscribeListener();
      setUnsubscribeListener(null);
    }
    
    // Set up real-time listener for changes to the blocked users
    if (user && isConnected) {
      const unsubscribe = firestore()
        .collection('userRelations')
        .doc(user.uid)
        .onSnapshot(async (doc) => {
          if (doc.exists) {
            const blockedList = doc.data().blockedUsers || [];
            setBlockedUsers(blockedList);
            await AsyncStorage.setItem(`blocked_users_${user.uid}`, JSON.stringify(blockedList));
          }
        }, error => {
          console.error('Error in blocked users real-time listener:', error);
        });
        
      setUnsubscribeListener(() => unsubscribe);
      
      return () => {
        unsubscribe();
      };
    }
  }, [user, isConnected]);
  
  // Clean up listener on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeListener) {
        unsubscribeListener();
      }
    };
  }, [unsubscribeListener]);
  
  // Function to block a user
  const blockUser = async (userIdToBlock) => {
    if (!user || !userIdToBlock) return false;
    
    try {
      // Optimistically update local state
      const updatedBlockedList = [...blockedUsers, userIdToBlock];
      setBlockedUsers(updatedBlockedList);
      
      // Update Firestore if online
      if (isConnected) {
        await firestore().collection('userRelations').doc(user.uid).update({
          blockedUsers: firestore.FieldValue.arrayUnion(userIdToBlock),
          lastUpdated: firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Update local cache
      await AsyncStorage.setItem(`blocked_users_${user.uid}`, JSON.stringify(updatedBlockedList));
      
      // Log analytics event
      AnalyticsService.logEvent('user_blocked', {
        target_user_id: userIdToBlock
      });
      
      return true;
    } catch (error) {
      console.error('Error blocking user:', error);
      
      // Revert local state on error
      setBlockedUsers(blockedUsers);
      return false;
    }
  };
  
  // Function to unblock a user
  const unblockUser = async (userIdToUnblock) => {
    if (!user || !userIdToUnblock) return false;
    
    try {
      // Optimistically update local state
      const updatedBlockedList = blockedUsers.filter(id => id !== userIdToUnblock);
      setBlockedUsers(updatedBlockedList);
      
      // Update Firestore if online
      if (isConnected) {
        await firestore().collection('userRelations').doc(user.uid).update({
          blockedUsers: firestore.FieldValue.arrayRemove(userIdToUnblock),
          lastUpdated: firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Update local cache
      await AsyncStorage.setItem(`blocked_users_${user.uid}`, JSON.stringify(updatedBlockedList));
      
      // Log analytics event
      AnalyticsService.logEvent('user_unblocked', {
        target_user_id: userIdToUnblock
      });
      
      return true;
    } catch (error) {
      console.error('Error unblocking user:', error);
      
      // Revert local state on error
      setBlockedUsers(blockedUsers);
      return false;
    }
  };
  
  // Function to check if a user is blocked
  const isUserBlocked = (userId) => {
    return blockedUsers.includes(userId);
  };
  
  // Function to check if user is blocked by another user
  const isBlockedByUser = (userId) => {
    return blockedByUsers.includes(userId);
  };
  
  // Function to filter content from blocked users
  const filterBlockedContent = (contentArray, userIdField = 'userId') => {
    if (!contentArray || !Array.isArray(contentArray)) return [];
    
    return contentArray.filter(item => {
      // Skip filtering if the item doesn't have a userId
      if (!item || !item[userIdField]) return true;
      
      // Filter out content from users who blocked this user
      // and users this user has blocked
      return !blockedUsers.includes(item[userIdField]) && 
             !blockedByUsers.includes(item[userIdField]);
    });
  };
  
  return (
    <BlockedUsersContext.Provider
      value={{
        blockedUsers,
        blockedByUsers,
        loading,
        blockUser,
        unblockUser,
        isUserBlocked,
        isBlockedByUser,
        filterBlockedContent,
      }}
    >
      {children}
    </BlockedUsersContext.Provider>
  );
};

export default BlockedUsersContext;
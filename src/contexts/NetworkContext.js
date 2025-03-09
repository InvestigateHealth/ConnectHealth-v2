// src/contexts/NetworkContext.js
// Context for network connectivity state management

import React, { createContext, useState, useEffect, useContext } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create context
const NetworkContext = createContext({
  isConnected: true,
  isInternetReachable: true,
  connectionType: null,
  lastOnline: null,
  pendingOperations: 0,
  setPendingOperations: () => {},
  appIsOnline: true,  // Combined state (user preference + actual connection)
  setUserGoesOffline: () => {},
  userPreferredOffline: false
});

// Custom hook to use the context
export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider = ({ children }) => {
  // Network state
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const [connectionType, setConnectionType] = useState(null);
  const [lastOnline, setLastOnline] = useState(Date.now());
  const [pendingOperations, setPendingOperations] = useState(0);
  
  // User can manually go offline mode to save data
  const [userPreferredOffline, setUserPreferredOffline] = useState(false);
  
  // Combined online state
  const appIsOnline = isConnected && !userPreferredOffline;

  // Load user offline preference from storage
  useEffect(() => {
    async function loadOfflinePreference() {
      try {
        const storedPreference = await AsyncStorage.getItem('userPreferredOffline');
        if (storedPreference !== null) {
          setUserPreferredOffline(storedPreference === 'true');
        }
      } catch (error) {
        console.error('Error loading offline preference:', error);
      }
    }

    loadOfflinePreference();
  }, []);

  // Function to allow user to toggle offline mode
  const setUserGoesOffline = async (goOffline) => {
    setUserPreferredOffline(goOffline);
    try {
      await AsyncStorage.setItem('userPreferredOffline', goOffline.toString());
    } catch (error) {
      console.error('Error saving offline preference:', error);
    }
  };

  useEffect(() => {
    // Function to handle connectivity changes
    const handleConnectivityChange = (state) => {
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
      setConnectionType(state.type);
      
      // Update lastOnline timestamp when connection is established
      if (state.isConnected && !isConnected) {
        setLastOnline(Date.now());
      }
    };

    // Subscribe to network info events
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

    // Get initial state
    NetInfo.fetch().then(handleConnectivityChange);

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [isConnected]);

  // Save network state to AsyncStorage for offline detection across app restarts
  useEffect(() => {
    async function saveNetworkState() {
      try {
        await AsyncStorage.setItem('lastNetworkState', JSON.stringify({
          isConnected,
          lastOnline,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error saving network state:', error);
      }
    }

    saveNetworkState();
  }, [isConnected, lastOnline]);

  // Context value
  const contextValue = {
    isConnected,
    isInternetReachable,
    connectionType,
    lastOnline,
    pendingOperations,
    setPendingOperations,
    appIsOnline,
    setUserGoesOffline,
    userPreferredOffline
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};

export default NetworkContext;

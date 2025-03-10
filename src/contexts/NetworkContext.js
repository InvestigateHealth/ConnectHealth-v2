// src/contexts/NetworkContext.js
// Context for network connectivity state management - Production ready

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsService } from '../services/AnalyticsService';

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
  userPreferredOffline: false,
  setOfflineMode: () => {}
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
  const appIsOnline = isConnected && isInternetReachable && !userPreferredOffline;

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
    
    // Initial network state check
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
      setConnectionType(state.type);
      
      // Log network state on init
      AnalyticsService.logEvent('network_state_changed', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type
      });
    });
  }, []);

  // Function to allow user to toggle offline mode
  const setUserGoesOffline = useCallback(async (goOffline) => {
    setUserPreferredOffline(goOffline);
    try {
      await AsyncStorage.setItem('userPreferredOffline', goOffline.toString());
      
      // Log user preference
      AnalyticsService.logEvent('user_offline_preference_changed', {
        preferOffline: goOffline
      });
    } catch (error) {
      console.error('Error saving offline preference:', error);
    }
  }, []);
  
  // External function to set offline mode (used by App.js)
  const setOfflineMode = useCallback((isOffline) => {
    // Only update if the value is changing to prevent unnecessary rerenders
    if (isOffline !== userPreferredOffline) {
      setUserGoesOffline(isOffline);
    }
  }, [userPreferredOffline, setUserGoesOffline]);

  useEffect(() => {
    // Function to handle connectivity changes
    const handleConnectivityChange = (state) => {
      const wasConnected = isConnected && isInternetReachable;
      const isNowConnected = state.isConnected && state.isInternetReachable;
      
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);
      setConnectionType(state.type);
      
      // Update lastOnline timestamp when connection is established
      if (isNowConnected) {
        setLastOnline(Date.now());
      }
      
      // Log network state changes
      if (wasConnected !== isNowConnected) {
        AnalyticsService.logEvent('network_state_changed', {
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          connectionType: state.type
        });
      }
    };

    // Subscribe to network info events
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, [isConnected, isInternetReachable]);

  // Save network state to AsyncStorage for offline detection across app restarts
  useEffect(() => {
    async function saveNetworkState() {
      try {
        await AsyncStorage.setItem('lastNetworkState', JSON.stringify({
          isConnected,
          isInternetReachable,
          lastOnline,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error saving network state:', error);
      }
    }

    saveNetworkState();
  }, [isConnected, isInternetReachable, lastOnline]);

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
    userPreferredOffline,
    setOfflineMode
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};

export default NetworkContext;
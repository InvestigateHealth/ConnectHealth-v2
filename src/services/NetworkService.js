// src/services/NetworkService.js
// Network connectivity monitoring with enhanced reliability

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const CONNECTIVITY_KEY = 'network_connectivity_status';
const CONNECTIVITY_CHECK_INTERVAL = 30000; // 30 seconds
const PING_TIMEOUT = 5000; // 5 seconds
const PING_ENDPOINTS = [
  'https://www.google.com',
  'https://www.apple.com',
  'https://www.amazon.com',
  'https://www.microsoft.com'
];

// Create context
const NetworkContext = createContext({
  isConnected: true,
  isInternetReachable: true,
  connectionType: null,
  connectionQuality: 'unknown', // 'excellent', 'good', 'fair', 'poor', 'unknown'
  connectionDetails: {},
  lastChecked: null
});

/**
 * Provider component for network connectivity state
 */
export const NetworkProvider = ({ children }) => {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isInternetReachable: true,
    connectionType: null,
    connectionQuality: 'unknown',
    connectionDetails: {},
    lastChecked: new Date()
  });
  const [hasShownOfflineAlert, setHasShownOfflineAlert] = useState(false);
  const [isAppActive, setIsAppActive] = useState(true);
  const pingTimerRef = useRef(null);
  const connectionCheckTimerRef = useRef(null);
  const netInfoUnsubscribeRef = useRef(null);

  // Load previous network state on initialization
  useEffect(() => {
    const loadSavedNetworkState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(CONNECTIVITY_KEY);
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          setNetworkState(prevState => ({
            ...prevState,
            ...parsedState,
            lastChecked: new Date(parsedState.lastChecked || Date.now())
          }));
        }
      } catch (error) {
        console.error('Error loading saved network state:', error);
      }
    };

    loadSavedNetworkState();
  }, []);

  // App state change listener
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      const isActive = nextAppState === 'active';
      setIsAppActive(isActive);

      if (isActive) {
        // Re-check connectivity when app comes to foreground
        checkConnectivity();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      appStateSubscription.remove();
    };
  }, []);

  // Save network state when it changes
  useEffect(() => {
    const saveNetworkState = async () => {
      try {
        await AsyncStorage.setItem(CONNECTIVITY_KEY, JSON.stringify({
          ...networkState,
          lastChecked: networkState.lastChecked.toISOString()
        }));
      } catch (error) {
        console.error('Error saving network state:', error);
      }
    };

    saveNetworkState();
  }, [networkState]);

  // Set up connectivity checks
  useEffect(() => {
    // Initial check
    checkConnectivity();

    // Subscribe to network state updates
    netInfoUnsubscribeRef.current = NetInfo.addEventListener(handleNetInfoChange);

    // Set up periodic connectivity checks
    connectionCheckTimerRef.current = setInterval(() => {
      if (isAppActive) {
        checkConnectivity();
      }
    }, CONNECTIVITY_CHECK_INTERVAL);

    return () => {
      if (netInfoUnsubscribeRef.current) {
        netInfoUnsubscribeRef.current();
      }
      if (connectionCheckTimerRef.current) {
        clearInterval(connectionCheckTimerRef.current);
      }
      if (pingTimerRef.current) {
        clearTimeout(pingTimerRef.current);
      }
    };
  }, [isAppActive]);

  /**
   * Handle network info change
   * 
   * @param {Object} state - NetInfo state
   */
  const handleNetInfoChange = async (state) => {
    // Estimate connection quality based on type
    let connectionQuality = 'unknown';
    if (state.isConnected) {
      if (state.type === 'wifi' || state.type === 'ethernet') {
        connectionQuality = 'excellent';
      } else if (state.type === 'cellular') {
        switch (state.details?.cellularGeneration) {
          case '5g':
            connectionQuality = 'excellent';
            break;
          case '4g':
            connectionQuality = 'good';
            break;
          case '3g':
            connectionQuality = 'fair';
            break;
          case '2g':
          case 'edge':
          case 'gprs':
            connectionQuality = 'poor';
            break;
          default:
            connectionQuality = 'fair';
        }
      }
    } else {
      connectionQuality = 'unknown';
    }

    // Update state with network info change
    const newState = {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      connectionType: state.type,
      connectionQuality,
      connectionDetails: state.details || {},
      lastChecked: new Date()
    };

    // If we detect internet is not reachable, verify with a ping
    if (state.isConnected && !state.isInternetReachable) {
      const isActuallyReachable = await pingInternetEndpoints();
      newState.isInternetReachable = isActuallyReachable;
    }

    setNetworkState(prevState => ({
      ...prevState,
      ...newState
    }));

    // If connection is lost, show alert
    if (!newState.isConnected && !hasShownOfflineAlert) {
      showOfflineAlert();
    }

    // If connection is restored, reset alert flag
    if (newState.isConnected && newState.isInternetReachable && hasShownOfflineAlert) {
      setHasShownOfflineAlert(false);
    }
  };

  /**
   * Full connectivity check using both NetInfo and ping
   */
  const checkConnectivity = async () => {
    try {
      // Get network state from NetInfo
      const state = await NetInfo.fetch();

      // Verify internet connectivity with ping
      let isInternetReachable = state.isInternetReachable;
      if (state.isConnected && (isInternetReachable === null || isInternetReachable === false)) {
        isInternetReachable = await pingInternetEndpoints();
      }

      // Update state
      handleNetInfoChange({
        ...state,
        isInternetReachable
      });
    } catch (error) {
      console.error('Error checking connectivity:', error);
    }
  };

  /**
   * Ping internet endpoints to verify actual connectivity
   * 
   * @returns {Promise<boolean>} Whether internet is reachable
   */
  const pingInternetEndpoints = async () => {
    // Select a random endpoint to ping
    const endpoint = PING_ENDPOINTS[Math.floor(Math.random() * PING_ENDPOINTS.length)];

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        pingTimerRef.current = setTimeout(() => {
          reject(new Error('Ping timeout'));
        }, PING_TIMEOUT);
      });

      // Create fetch promise with simple HEAD request
      const fetchPromise = fetch(endpoint, {
        method: 'HEAD',
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
      });

      // Race the fetch against the timeout
      await Promise.race([fetchPromise, timeoutPromise]);

      // Clear timeout
      if (pingTimerRef.current) {
        clearTimeout(pingTimerRef.current);
        pingTimerRef.current = null;
      }

      return true;
    } catch (error) {
      console.log(`Ping failed for ${endpoint}:`, error.message);
      return false;
    }
  };

  /**
   * Show offline alert
   */
  const showOfflineAlert = () => {
    if (!hasShownOfflineAlert) {
      Alert.alert(
        'No Internet Connection',
        'You are currently offline. Some features may be limited.',
        [{ text: 'OK' }]
      );
      setHasShownOfflineAlert(true);
    }
  };

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
};

/**
 * Hook to access network state
 */
export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

/**
 * Higher-order component to handle offline state
 * 
 * @param {Component} WrappedComponent - React component to wrap
 * @param {Object} options - Configuration options
 * @returns {Component} Wrapped component with offline handling
 */
export const withNetworkConnectivity = (WrappedComponent, options = {}) => {
  const { showOfflineMessage = true } = options;
  
  return props => {
    const { isConnected, isInternetReachable, connectionQuality } = useNetwork();
    const isOffline = !isConnected || isInternetReachable === false;
    const isLowQualityConnection = connectionQuality === 'poor';
    
    // Pass network state to the wrapped component
    return (
      <WrappedComponent
        {...props}
        isOffline={isOffline}
        isLowQualityConnection={isLowQualityConnection}
        connectionQuality={connectionQuality}
        showOfflineMessage={showOfflineMessage && isOffline}
      />
    );
  };
};

/**
 * Utility to check if the device is currently online
 * Useful for preventing network operations when offline
 * 
 * @returns {Promise<boolean>} Whether the device is online
 */
export const isDeviceOnline = async () => {
  try {
    const state = await NetInfo.fetch();
    
    // If NetInfo says we're offline, return false immediately
    if (!state.isConnected) {
      return false;
    }
    
    // If NetInfo is uncertain about internet reachability, verify with ping
    if (state.isInternetReachable === null || state.isInternetReachable === false) {
      // Select a random endpoint to ping
      const endpoint = PING_ENDPOINTS[Math.floor(Math.random() * PING_ENDPOINTS.length)];
      
      try {
        const response = await Promise.race([
          fetch(endpoint, { method: 'HEAD', cache: 'no-cache' }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Ping timeout')), PING_TIMEOUT)
          )
        ]);
        
        return response.ok;
      } catch (error) {
        return false;
      }
    }
    
    // Return NetInfo's assessment of internet reachability
    return state.isInternetReachable === true;
  } catch (error) {
    console.error('Error checking online status:', error);
    return false;
  }
};

/**
 * Retry a function with exponential backoff based on network conditions
 * 
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of function
 */
export const withNetworkRetry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    onRetry = null,
  } = options;
  
  let retries = 0;
  let delay = initialDelay;
  
  while (true) {
    try {
      // Check if device is online before attempting
      const online = await isDeviceOnline();
      if (!online) {
        throw new Error('Device is offline');
      }
      
      return await fn();
    } catch (error) {
      retries++;
      
      // Check if we've reached max retries
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Calculate next delay with exponential backoff
      delay = Math.min(delay * factor, maxDelay);
      
      // Notify on retry if callback provided
      if (onRetry) {
        onRetry(retries, delay, error);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

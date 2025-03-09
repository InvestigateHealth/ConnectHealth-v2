// src/services/NetworkService.js
// Network connectivity monitoring with enhanced reliability and cross-platform consistency

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Analytics } from './AnalyticsService';

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
  lastChecked: null,
  checkConnectivity: () => Promise.resolve(true)
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
  const lastCheckRef = useRef(Date.now());
  const consecutiveOfflineChecksRef = useRef(0);
  const isMountedRef = useRef(true);

  // Load previous network state on initialization
  useEffect(() => {
    const loadSavedNetworkState = async () => {
      try {
        const savedState = await AsyncStorage.getItem(CONNECTIVITY_KEY);
        if (savedState && isMountedRef.current) {
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
    return () => {
      isMountedRef.current = false;
    };
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

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
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
      if (isAppActive && Date.now() - lastCheckRef.current > CONNECTIVITY_CHECK_INTERVAL) {
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
  const handleNetInfoChange = useCallback(async (state) => {
    if (!isMountedRef.current) return;
    
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

    // If we detect internet is not reachable but connected, verify with a ping
    if (state.isConnected && !state.isInternetReachable) {
      const isActuallyReachable = await pingInternetEndpoints();
      newState.isInternetReachable = isActuallyReachable;
    }

    if (isMountedRef.current) {
      setNetworkState(prevState => ({
        ...prevState,
        ...newState
      }));
      
      // Reset if we're online now
      if (newState.isConnected && newState.isInternetReachable) {
        consecutiveOfflineChecksRef.current = 0;
      }
    }

    // If connection is lost, show alert
    if (!newState.isConnected && !hasShownOfflineAlert) {
      showOfflineAlert();
    }

    // If connection is restored, reset alert flag
    if (newState.isConnected && newState.isInternetReachable && hasShownOfflineAlert) {
      setHasShownOfflineAlert(false);
    }
    
    // Track significant changes in analytics
    if (state.isConnected !== networkState.isConnected || 
        state.isInternetReachable !== networkState.isInternetReachable) {
      Analytics.logEvent('connectivity_change', {
        is_connected: state.isConnected,
        is_reachable: state.isInternetReachable,
        connection_type: state.type,
        connection_quality: connectionQuality
      });
    }
    
    lastCheckRef.current = Date.now();
  }, [networkState, hasShownOfflineAlert]);

  /**
   * Full connectivity check using both NetInfo and ping
   */
  const checkConnectivity = useCallback(async () => {
    try {
      // Get network state from NetInfo
      const state = await NetInfo.fetch();

      // Verify internet connectivity with ping
      let isInternetReachable = state.isInternetReachable;
      
      // If device says it's connected but internet reachability is unknown or false
      if (state.isConnected && (isInternetReachable === null || isInternetReachable === false)) {
        isInternetReachable = await pingInternetEndpoints();
        
        // Track consecutive offline checks
        if (!isInternetReachable) {
          consecutiveOfflineChecksRef.current++;
        } else {
          consecutiveOfflineChecksRef.current = 0;
        }
      } else if (!state.isConnected) {
        // If device reports not connected, we're definitely offline
        consecutiveOfflineChecksRef.current++;
      } else {
        // Connected and internet is reachable, reset counter
        consecutiveOfflineChecksRef.current = 0;
      }

      // Update state
      handleNetInfoChange({
        ...state,
        isInternetReachable
      });
      
      // Record the time of this check
      lastCheckRef.current = Date.now();
      
      return state.isConnected && isInternetReachable;
    } catch (error) {
      console.error('Error checking connectivity:', error);
      return false;
    }
  }, [handleNetInfoChange]);

  /**
   * Ping internet endpoints to verify actual connectivity
   * 
   * @returns {Promise<boolean>} Whether internet is reachable
   */
  const pingInternetEndpoints = useCallback(async () => {
    // Try all endpoints in parallel for faster checking
    try {
      const pingPromises = PING_ENDPOINTS.map(endpoint => {
        return new Promise(async (resolve) => {
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

            resolve(true);
          } catch (error) {
            console.log(`Ping failed for ${endpoint}:`, error.message);
            resolve(false);
          }
        });
      });

      // If any ping succeeds, we have internet
      const results = await Promise.all(pingPromises);
      return results.some(result => result === true);
    } catch (error) {
      console.error('Error pinging endpoints:', error);
      return false;
    }
  }, []);

  /**
   * Show offline alert
   */
  const showOfflineAlert = useCallback(() => {
    if (!hasShownOfflineAlert) {
      Alert.alert(
        'No Internet Connection',
        'You are currently offline. Some features may be limited.',
        [{ text: 'OK' }]
      );
      setHasShownOfflineAlert(true);
      
      // Track in analytics
      Analytics.logEvent('offline_alert_shown', {
        consecutive_offline_checks: consecutiveOfflineChecksRef.current
      });
    }
  }, [hasShownOfflineAlert]);

  // Exposed context value
  const contextValue = {
    ...networkState,
    isOffline: !networkState.isConnected || networkState.isInternetReachable === false,
    checkConnectivity
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};

/**
 * Hook to access network state
 * @returns {Object} Network state and functions
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
  const { 
    showOfflineMessage = true,
    checkOnMount = true
  } = options;
  
  const WithNetworkConnectivity = (props) => {
    const { 
      isConnected, 
      isInternetReachable, 
      connectionQuality,
      checkConnectivity
    } = useNetwork();
    
    const isOffline = !isConnected || isInternetReachable === false;
    const isLowQualityConnection = connectionQuality === 'poor';
    
    // Check connectivity when component mounts
    useEffect(() => {
      if (checkOnMount) {
        checkConnectivity();
      }
    }, []);
    
    // Pass network state to the wrapped component
    return (
      <WrappedComponent
        {...props}
        isOffline={isOffline}
        isLowQualityConnection={isLowQualityConnection}
        connectionQuality={connectionQuality}
        showOfflineMessage={showOfflineMessage && isOffline}
        checkConnectivity={checkConnectivity}
      />
    );
  };
  
  // Set display name for better debugging
  WithNetworkConnectivity.displayName = `WithNetworkConnectivity(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  
  return WithNetworkConnectivity;
};

/**
 * Utility to check if the device is currently online with a full connectivity check
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
      // Try to ping multiple endpoints in parallel
      const pingPromises = PING_ENDPOINTS.map(endpoint => {
        return new Promise((resolve) => {
          try {
            const controller = new AbortController();
            const signal = controller.signal;
            
            // Set timeout to abort fetch after PING_TIMEOUT
            const timeoutId = setTimeout(() => {
              controller.abort();
              resolve(false);
            }, PING_TIMEOUT);
            
            fetch(endpoint, { 
              method: 'HEAD', 
              cache: 'no-cache', 
              signal 
            })
              .then(response => {
                clearTimeout(timeoutId);
                resolve(response.ok);
              })
              .catch(() => {
                clearTimeout(timeoutId);
                resolve(false);
              });
          } catch (error) {
            resolve(false);
          }
        });
      });
      
      // If any endpoint responds, we're online
      const results = await Promise.all(pingPromises);
      return results.some(result => result === true);
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
    checkConnectivity = true
  } = options;
  
  let retries = 0;
  let delay = initialDelay;
  
  while (true) {
    try {
      // Check if device is online before attempting if requested
      if (checkConnectivity) {
        const online = await isDeviceOnline();
        if (!online) {
          throw new Error('Device is offline');
        }
      }
      
      return await fn();
    } catch (error) {
      retries++;
      
      // Check if we've reached max retries
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Log retry attempt
      console.log(`Retry attempt ${retries}/${maxRetries}`, error.message);
      
      // Calculate next delay with exponential backoff and some jitter
      const jitter = 0.1 * delay * Math.random();
      delay = Math.min(delay * factor + jitter, maxDelay);
      
      // Notify on retry if callback provided
      if (onRetry) {
        onRetry(retries, delay, error);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Check connectivity again before next attempt if requested
      if (checkConnectivity) {
        const online = await isDeviceOnline();
        if (!online) {
          throw new Error('Device is offline');
        }
      }
    }
  }
};

export default {
  NetworkProvider,
  useNetwork,
  withNetworkConnectivity,
  isDeviceOnline,
  withNetworkRetry
};
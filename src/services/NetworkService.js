// src/services/NetworkService.js
// Network connectivity monitoring

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Create context
const NetworkContext = createContext({
  isConnected: true,
  isInternetReachable: true
});

/**
 * Provider component for network connectivity state
 */
export const NetworkProvider = ({ children }) => {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isInternetReachable: true
  });
  const [hasShownOfflineAlert, setHasShownOfflineAlert] = useState(false);

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable
      });
      
      // Show alert when connection is lost (but only once)
      if (state.isConnected === false && !hasShownOfflineAlert) {
        Alert.alert(
          'No Internet Connection',
          'You are currently offline. Some features may be limited.',
          [{ text: 'OK' }]
        );
        setHasShownOfflineAlert(true);
      }
      
      // Reset the alert flag when connection is restored
      if (state.isConnected === true && state.isInternetReachable === true) {
        setHasShownOfflineAlert(false);
      }
    });

    // Initial network check
    NetInfo.fetch().then(state => {
      setNetworkState({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable
      });
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, [hasShownOfflineAlert]);

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
    const { isConnected, isInternetReachable } = useNetwork();
    const isOffline = !isConnected || isInternetReachable === false;
    
    // Pass network state to the wrapped component
    return (
      <WrappedComponent
        {...props}
        isOffline={isOffline}
        showOfflineMessage={showOfflineMessage && isOffline}
      />
    );
  };
};

// src/services/RetryService.js
// Auto-retry functionality for network operations

/**
 * Retry a function with exponential backoff
 * 
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of function
 */
export const retry = async (fn, options = {}) => {
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
      return await fn();
    } catch (error) {
      retries++;
      
      // Exit if max retries reached
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

/**
 * Wrapper function to add retry capability to any Firebase operation
 * 
 * @param {Function} firebaseOperation - Firebase operation to perform
 * @param {Object} options - Retry options
 * @returns {Promise} Result of operation
 */
export const withRetry = (firebaseOperation, options = {}) => {
  return retry(firebaseOperation, options);
};

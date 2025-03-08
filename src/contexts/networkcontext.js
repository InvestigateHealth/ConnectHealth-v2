// src/contexts/NetworkContext.js
// Network connectivity state management

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Create context
const NetworkContext = createContext({
  isConnected: true,
  isInternetReachable: true,
  type: 'unknown'
});

/**
 * Provider component for network connectivity state
 */
export const NetworkProvider = ({ children }) => {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown'
  });
  const [hasShownOfflineAlert, setHasShownOfflineAlert] = useState(false);

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type
      });
      
      // Show alert when connection is lost (but only once)
      if (state.isConnected === false && !hasShownOfflineAlert) {
        Alert.alert(
          'No Internet Connection',
          'You are currently offline. Some features may be limited but you can still view cached content.',
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
        isInternetReachable: state.isInternetReachable,
        type: state.type
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
 * @param {React.Component} WrappedComponent - React component to wrap
 * @param {Object} options - Configuration options
 * @returns {React.Component} Wrapped component with offline handling
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

/**
 * Offline Notice component to display when offline
 */
export const OfflineNotice = () => {
  const { isConnected, isInternetReachable } = useNetwork();
  const isOffline = !isConnected || isInternetReachable === false;
  
  if (!isOffline) {
    return null;
  }
  
  return (
    <View style={styles.offlineContainer}>
      <Text style={styles.offlineText}>No Internet Connection</Text>
    </View>
  );
};

const styles = {
  offlineContainer: {
    backgroundColor: '#b52424',
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
    position: 'absolute',
    top: 0,
    zIndex: 1000,
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  }
};

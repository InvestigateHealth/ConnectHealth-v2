// src/contexts/NetworkContext.js
// Enhanced Network Context with better offline handling and network quality assessment

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import { Platform } from 'react-native';
import { AnalyticsService } from '../services/AnalyticsService';

// Create context
const NetworkContext = createContext();

// Parse config values
const CONNECTION_CHECK_INTERVAL = parseInt(Config.CONNECTION_CHECK_INTERVAL_SECONDS || '30', 10) * 1000;

export const NetworkProvider = ({ children }) => {
  // Network state
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const [networkType, setNetworkType] = useState(null);
  const [connectionQuality, setConnectionQuality] = useState('unknown');
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [lastOnlineTimestamp, setLastOnlineTimestamp] = useState(null);
  
  // Network quality check
  const checkConnectionQuality = useCallback(async (state) => {
    try {
      if (!state.isConnected || !state.isInternetReachable) {
        setConnectionQuality('offline');
        return;
      }
      
      // Start performance measurement
      const startTime = Date.now();
      
      // Perform a lightweight request to check connection quality
      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
        // Short timeout for quick feedback
        signal: AbortSignal.timeout(3000),
      });
      
      const endTime = Date.now();
      const pingTime = endTime - startTime;
      
      // Determine connection quality based on ping time
      let quality = 'unknown';
      if (pingTime < 150) {
        quality = 'excellent';
      } else if (pingTime < 300) {
        quality = 'good';
      } else if (pingTime < 600) {
        quality = 'fair';
      } else {
        quality = 'poor';
      }
      
      setConnectionQuality(quality);
      
      // Log connection quality for analytics
      AnalyticsService.logEvent('network_quality_check', {
        quality,
        pingTime,
        networkType: state.type,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });
      
      return quality;
    } catch (error) {
      console.log('Connection quality check failed:', error);
      setConnectionQuality('poor');
      
      // Log error
      AnalyticsService.logError(error, { 
        context: 'connection_quality_check',
        networkState: JSON.stringify({
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          networkType: state.type,
        })
      });
      
      return 'poor';
    }
  }, []);
  
  // Update network info and handle state changes
  const handleNetInfoChange = useCallback(async (state) => {
    const wasConnected = isConnected && isInternetReachable;
    const isNowConnected = state.isConnected && state.isInternetReachable;
    
    // Update state
    setIsConnected(state.isConnected);
    setIsInternetReachable(state.isInternetReachable);
    setNetworkType(state.type);
    
    // Check connection quality if connected
    if (isNowConnected) {
      // We're online now
      setLastOnlineTimestamp(Date.now());
      
      // Check connection quality
      await checkConnectionQuality(state);
      
      // If we were offline and now we're online, process the offline queue
      if (!wasConnected && offlineQueue.length > 0) {
        processOfflineQueue();
      }
    } else {
      // We're offline now
      setConnectionQuality('offline');
    }
    
    // Log network state change event
    AnalyticsService.logEvent('network_state_changed', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      networkType: state.type,
      wasConnected,
      isNowConnected,
    });
  }, [isConnected, isInternetReachable, offlineQueue, checkConnectionQuality]);
  
  // Process operations that were queued while offline
  const processOfflineQueue = useCallback(async () => {
    try {
      // Get the current queue
      const currentQueue = [...offlineQueue];
      
      if (currentQueue.length === 0) {
        return;
      }
      
      // Clear the queue immediately to prevent duplicates
      setOfflineQueue([]);
      
      // Also clear from AsyncStorage
      await AsyncStorage.setItem('offlineQueue', JSON.stringify([]));
      
      // Log start of processing
      AnalyticsService.logEvent('offline_queue_processing', {
        queueLength: currentQueue.length,
        timestamp: Date.now(),
      });
      
      // Process each queued operation
      for (const operation of currentQueue) {
        try {
          // This would typically call your API service or other handler
          // based on the operation type
          console.log('Processing offline operation:', operation);
          
          // Example implementation:
          // switch (operation.type) {
          //   case 'CREATE_POST':
          //     await apiService.createPost(operation.data);
          //     break;
          //   case 'LIKE_POST':
          //     await apiService.likePost(operation.data.postId);
          //     break;
          //   // ... handle other operation types
          // }
          
          // Log successful processing
          AnalyticsService.logEvent('offline_operation_processed', {
            operationType: operation.type,
            success: true,
            timestamp: Date.now(),
          });
        } catch (operationError) {
          console.error('Error processing offline operation:', operationError);
          
          // Log error
          AnalyticsService.logError(operationError, {
            context: 'offline_operation_processing',
            operationType: operation.type,
            operationData: JSON.stringify(operation.data),
          });
          
          // Re-queue the operation if it failed
          // This prevents losing data if some operations fail
          addToOfflineQueue(operation);
        }
      }
    } catch (error) {
      console.error('Error processing offline queue:', error);
      
      // Log error
      AnalyticsService.logError(error, { 
        context: 'offline_queue_processing',
        queueLength: offlineQueue.length,
      });
    }
  }, [offlineQueue]);
  
  // Add operation to offline queue
  const addToOfflineQueue = useCallback(async (operation) => {
    try {
      // Create the updated queue
      const updatedQueue = [...offlineQueue, operation];
      
      // Update state
      setOfflineQueue(updatedQueue);
      
      // Persist queue to AsyncStorage
      await AsyncStorage.setItem('offlineQueue', JSON.stringify(updatedQueue));
      
      // Log queued operation
      AnalyticsService.logEvent('operation_queued_offline', {
        operationType: operation.type,
        timestamp: Date.now(),
        queueLength: updatedQueue.length,
      });
      
      return true;
    } catch (error) {
      console.error('Error adding to offline queue:', error);
      
      // Log error
      AnalyticsService.logError(error, { 
        context: 'add_to_offline_queue',
        operationType: operation.type,
      });
      
      return false;
    }
  }, [offlineQueue]);
  
  // Initialize network monitoring
  useEffect(() => {
    // Load offline queue from AsyncStorage on startup
    const loadOfflineQueue = async () => {
      try {
        const queueJson = await AsyncStorage.getItem('offlineQueue');
        
        if (queueJson) {
          const loadedQueue = JSON.parse(queueJson);
          setOfflineQueue(loadedQueue);
          
          // Log loaded queue
          AnalyticsService.logEvent('offline_queue_loaded', {
            queueLength: loadedQueue.length,
          });
        }
      } catch (error) {
        console.error('Error loading offline queue:', error);
        
        // Log error
        AnalyticsService.logError(error, { context: 'load_offline_queue' });
      }
    };
    
    loadOfflineQueue();
    
    // Get initial network state
    NetInfo.fetch().then(state => {
      handleNetInfoChange(state);
    });
    
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(handleNetInfoChange);
    
    // Set up periodic connection quality checks
    const checkInterval = setInterval(() => {
      NetInfo.fetch().then(state => {
        if (state.isConnected && state.isInternetReachable) {
          checkConnectionQuality(state);
        }
      });
    }, CONNECTION_CHECK_INTERVAL);
    
    // Clean up on unmount
    return () => {
      unsubscribe();
      clearInterval(checkInterval);
    };
  }, [handleNetInfoChange, checkConnectionQuality]);
  
  // Format time since last online
  const getTimeSinceLastOnline = useCallback(() => {
    if (!lastOnlineTimestamp) return 'Unknown';
    
    const now = Date.now();
    const diffMs = now - lastOnlineTimestamp;
    
    if (diffMs < 60000) {
      return `${Math.floor(diffMs / 1000)} seconds ago`;
    } else if (diffMs < 3600000) {
      return `${Math.floor(diffMs / 60000)} minutes ago`;
    } else if (diffMs < 86400000) {
      return `${Math.floor(diffMs / 3600000)} hours ago`;
    } else {
      return `${Math.floor(diffMs / 86400000)} days ago`;
    }
  }, [lastOnlineTimestamp]);

  return (
    <NetworkContext.Provider
      value={{
        isConnected,
        isInternetReachable,
        networkType,
        connectionQuality,
        offlineMode,
        setOfflineMode,
        offlineQueue,
        addToOfflineQueue,
        processOfflineQueue,
        lastOnlineTimestamp,
        getTimeSinceLastOnline,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

// Custom hook to use the network context
export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

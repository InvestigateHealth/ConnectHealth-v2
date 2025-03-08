// src/components/NetworkMonitor.js
// Component to display network status with proper animation configs

import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  Dimensions,
  Platform,
  AccessibilityInfo
} from 'react-native';
import { useNetwork } from '../contexts/NetworkContext';
import { useTheme } from '../theme/ThemeContext';
import { useAccessibility } from '../hooks/useAccessibility';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const NetworkMonitor = () => {
  const { isConnected, isInternetReachable } = useNetwork();
  const { theme } = useTheme();
  const { reducedMotion } = useAccessibility();
  const isOffline = !isConnected || isInternetReachable === false;
  
  const [visible, setVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-50)).current; // Start offscreen

  // Announce network status changes to screen readers
  useEffect(() => {
    const announceNetworkChange = async () => {
      const screenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      
      if (screenReaderEnabled) {
        const message = isOffline ? 
          'Network connection lost. You are now offline.' : 
          'Network connection restored. You are now online.';
          
        AccessibilityInfo.announceForAccessibility(message);
      }
    };
    
    announceNetworkChange();
  }, [isOffline]);

  useEffect(() => {
    if (isOffline && !visible) {
      setVisible(true);
      
      // If reduced motion is enabled, skip animation
      if (reducedMotion) {
        slideAnim.setValue(0);
      } else {
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true, // Enable native driver for better performance
        }).start();
      }
    } else if (!isOffline && visible) {
      // If reduced motion is enabled, skip animation and hide immediately
      if (reducedMotion) {
        setVisible(false);
        slideAnim.setValue(-50);
      } else {
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 300,
          useNativeDriver: true, // Enable native driver for better performance
        }).start(() => {
          setVisible(false);
        });
      }
    }
  }, [isOffline, visible, reducedMotion]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          backgroundColor: theme.colors.error.main,
          transform: [{ translateY: slideAnim }]
        }
      ]}
      accessibilityRole="alert"
      accessibilityLabel="Network status alert"
      accessibilityLiveRegion="assertive"
    >
      <Icon name="cloud-offline" size={20} color="white" />
      <Text style={styles.text}>No Internet Connection</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 9999,
    width: width,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  text: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: 'bold',
  }
});

export default NetworkMonitor;
// src/components/NetworkMonitor.js
// Component to display network status

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useNetwork } from '../contexts/NetworkContext';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');

const NetworkMonitor = () => {
  const { isConnected, isInternetReachable } = useNetwork();
  const { theme } = useTheme();
  const isOffline = !isConnected || isInternetReachable === false;
  
  const [slideAnim] = useState(new Animated.Value(-50)); // Start offscreen
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOffline && !visible) {
      setVisible(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (!isOffline && visible) {
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
      });
    }
  }, [isOffline]);

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
  },
  text: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: 'bold',
  }
});

export default NetworkMonitor;

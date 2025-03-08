// src/components/ThemeToggleButton.js
// Floating theme toggle button component

import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';

const ThemeToggleButton = ({ style, size = 'medium' }) => {
  const { isDarkMode, toggleDarkMode, theme } = useTheme();
  const scaleAnim = new Animated.Value(1);
  
  // Get button size based on the size prop
  const getButtonSize = () => {
    switch (size) {
      case 'small': return 40;
      case 'large': return 60;
      default: return 50; // medium size
    }
  };
  
  // Get icon size based on the button size
  const getIconSize = () => {
    switch (size) {
      case 'small': return 20;
      case 'large': return 30;
      default: return 24; // medium size
    }
  };
  
  // Button animation on press
  const animateButton = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  // Handle toggle with animation
  const handleToggle = () => {
    animateButton();
    toggleDarkMode();
  };
  
  const buttonSize = getButtonSize();
  const iconSize = getIconSize();
  
  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <TouchableOpacity
        style={[
          styles.button,
          {
            width: button
// src/components/ThemeToggleButton.js
// Floating theme toggle button component with proper animation using useNativeDriver

import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { useAccessibility } from '../hooks/useAccessibility';

const ThemeToggleButton = ({ style, size = 'medium' }) => {
  const { isDarkMode, toggleDarkMode, theme } = useTheme();
  const { reducedMotion } = useAccessibility();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
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
  
  // Button animation on press, respecting the reducedMotion preference
  const animateButton = () => {
    if (reducedMotion) {
      // Skip animation if user prefers reduced motion
      return;
    }
    
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true, // Ensure we're using the native driver for performance
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
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
            backgroundColor: isDarkMode ? theme.colors.background.paper : theme.colors.primary.main,
          },
          style,
        ]}
        onPress={handleToggle}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        accessibilityHint="Toggles between light and dark theme"
      >
        <Icon 
          name={isDarkMode ? "sunny-outline" : "moon-outline"} 
          size={iconSize} 
          color={isDarkMode ? theme.colors.primary.main : theme.colors.common.white} 
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
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
});

export default ThemeToggleButton;

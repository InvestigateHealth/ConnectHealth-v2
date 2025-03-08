// src/theme/ThemeContext.js
// Theme provider with light and dark mode support

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from './theme';

// Create context
const ThemeContext = createContext();

// Theme modes
export const ThemeMode = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

/**
 * Theme provider component
 */
export const ThemeProvider = ({ children }) => {
  // State to track the user's theme preference
  const [themeMode, setThemeMode] = useState(ThemeMode.SYSTEM);
  // State to track whether dark mode is active
  const [isDarkMode, setIsDarkMode] = useState(false);
  // Get the system color scheme
  const colorScheme = useColorScheme();

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedThemeMode = await AsyncStorage.getItem('themeMode');
        if (savedThemeMode) {
          setThemeMode(savedThemeMode);
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      }
    };
    
    loadThemePreference();
  }, []);

  // Update dark mode based on theme mode and system setting
  useEffect(() => {
    if (themeMode === ThemeMode.SYSTEM) {
      setIsDarkMode(colorScheme === 'dark');
    } else {
      setIsDarkMode(themeMode === ThemeMode.DARK);
    }
  }, [themeMode, colorScheme]);

  // Get the current theme object
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Save theme preference
  const saveThemePreference = async (mode) => {
    try {
      await AsyncStorage.setItem('themeMode', mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  /**
   * Change theme mode
   * 
   * @param {string} mode - Theme mode to set
   */
  const changeThemeMode = (mode) => {
    setThemeMode(mode);
    saveThemePreference(mode);
  };

  // Value provided to consumers
  const value = {
    theme,
    isDarkMode,
    themeMode,
    changeThemeMode
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access theme context
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

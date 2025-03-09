// src/theme/ThemeContext.js
// Context for managing app theme

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from './themes';

// Theme mode constants
export const ThemeMode = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};

// Create the theme context
const ThemeContext = createContext({
  theme: lightTheme,
  themeMode: ThemeMode.SYSTEM,
  isDarkMode: false,
  changeThemeMode: () => {},
});

// Theme provider component
export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState(ThemeMode.SYSTEM);
  const [theme, setTheme] = useState(lightTheme);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Load saved theme mode on mount
  useEffect(() => {
    const loadSavedThemeMode = async () => {
      try {
        const savedThemeMode = await AsyncStorage.getItem('themeMode');
        if (savedThemeMode) {
          setThemeMode(savedThemeMode);
        }
      } catch (error) {
        console.error('Error loading saved theme mode:', error);
      }
    };

    loadSavedThemeMode();
  }, []);

  // Update theme when theme mode or system preference changes
  useEffect(() => {
    let newIsDarkMode = false;

    if (themeMode === ThemeMode.SYSTEM) {
      newIsDarkMode = systemColorScheme === 'dark';
    } else {
      newIsDarkMode = themeMode === ThemeMode.DARK;
    }

    setIsDarkMode(newIsDarkMode);
    setTheme(newIsDarkMode ? darkTheme : lightTheme);
  }, [themeMode, systemColorScheme]);

  // Function to change theme mode
  const changeThemeMode = async (newThemeMode) => {
    setThemeMode(newThemeMode);
    
    // Save to storage
    try {
      await AsyncStorage.setItem('themeMode', newThemeMode);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  };

  // Context value
  const value = {
    theme,
    themeMode,
    isDarkMode,
    changeThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook for using the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// src/theme/ThemeContext.js
// Enhanced theme context with improved type definitions

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import themeDefinitions, { lightTheme, darkTheme, highContrastTheme } from './themeColors';
import { useAccessibility } from '../hooks/useAccessibility';

// Theme mode enum
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
  toggleTheme: () => {},
});

// Theme provider component
export const ThemeProvider = ({ children }) => {
  // Get device color scheme
  const colorScheme = useColorScheme();
  
  // Access accessibility context if available
  const accessibility = useAccessibility ? useAccessibility() : { highContrast: false };
  
  // State for theme mode
  const [themeMode, setThemeMode] = useState(ThemeMode.SYSTEM);
  const [theme, setTheme] = useState(lightTheme);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Load saved theme mode on mount
  useEffect(() => {
    const loadThemeMode = async () => {
      try {
        const savedThemeMode = await AsyncStorage.getItem('themeMode');
        if (savedThemeMode) {
          setThemeMode(savedThemeMode);
        }
      } catch (error) {
        console.error('Error loading theme mode:', error);
      }
    };
    
    loadThemeMode();
  }, []);
  
  // Update theme when theme mode or system theme changes
  useEffect(() => {
    let effectiveThemeMode = themeMode;
    
    // If system theme, use device preference
    if (themeMode === ThemeMode.SYSTEM) {
      effectiveThemeMode = colorScheme === 'dark' ? ThemeMode.DARK : ThemeMode.LIGHT;
    }
    
    // Set dark mode flag
    const newIsDarkMode = effectiveThemeMode === ThemeMode.DARK;
    setIsDarkMode(newIsDarkMode);
    
    // Apply high contrast theme if enabled, otherwise use regular theme
    if (accessibility.highContrast) {
      setTheme(highContrastTheme);
    } else {
      setTheme(newIsDarkMode ? darkTheme : lightTheme);
    }
    
  }, [themeMode, colorScheme, accessibility.highContrast]);
  
  // Save theme mode when it changes
  useEffect(() => {
    const saveThemeMode = async () => {
      try {
        await AsyncStorage.setItem('themeMode', themeMode);
      } catch (error) {
        console.error('Error saving theme mode:', error);
      }
    };
    
    saveThemeMode();
  }, [themeMode]);
  
  // Change theme mode
  const changeThemeMode = (newMode) => {
    if (Object.values(ThemeMode).includes(newMode)) {
      setThemeMode(newMode);
    }
  };
  
  // Toggle between light and dark theme
  const toggleTheme = () => {
    // If in system mode, switch to explicit light/dark mode
    if (themeMode === ThemeMode.SYSTEM) {
      setThemeMode(isDarkMode ? ThemeMode.LIGHT : ThemeMode.DARK);
    } else {
      // Otherwise toggle between light and dark
      setThemeMode(themeMode === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK);
    }
  };
  
  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        isDarkMode,
        changeThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;

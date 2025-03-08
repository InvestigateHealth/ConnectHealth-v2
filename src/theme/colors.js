// src/theme/colors.js
// Centralized color palette

export const colors = {
  // Primary colors
  primary: {
    light: '#64B5F6',   // Light blue
    main: '#2196F3',    // Blue
    dark: '#1976D2',    // Dark blue
    contrastText: '#FFFFFF'
  },
  
  // Secondary colors
  secondary: {
    light: '#4CAF50',   // Light green
    main: '#388E3C',    // Green
    dark: '#2E7D32',    // Dark green
    contrastText: '#FFFFFF'
  },
  
  // Alert colors
  error: {
    light: '#EF5350',
    main: '#F44336',
    dark: '#D32F2F',
    contrastText: '#FFFFFF'
  },
  warning: {
    light: '#FFB74D',
    main: '#FF9800',
    dark: '#F57C00',
    contrastText: '#FFFFFF'
  },
  info: {
    light: '#4FC3F7',
    main: '#29B6F6',
    dark: '#0288D1',
    contrastText: '#FFFFFF'
  },
  success: {
    light: '#81C784',
    main: '#4CAF50',
    dark: '#388E3C',
    contrastText: '#FFFFFF'
  },
  
  // Grayscale
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121'
  },
  
  // Text
  text: {
    primary: '#263238',     // Near black
    secondary: '#546E7A',   // Dark gray with blue tint
    disabled: '#9E9E9E',    // Medium gray
    hint: '#78909C'         // Blue-gray
  },
  
  // Background
  background: {
    default: '#F5F7F8',     // Light gray with blue tint
    paper: '#FFFFFF',       // White
    card: '#FFFFFF',        // White for cards
    input: '#F5F7F8'        // Light gray for inputs
  },
  
  // Dividers
  divider: '#ECEFF1',       // Very light blue-gray
  
  // Common colors
  common: {
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent'
  }
};

// src/theme/spacing.js
// Consistent spacing system

export const spacing = {
  // Base unit in pixels
  unit: 4,
  
  // Named spacing values
  xs: 4,     // 4px - Extra small
  sm: 8,     // 8px - Small
  md: 16,    // 16px - Medium
  lg: 24,    // 24px - Large
  xl: 32,    // 32px - Extra large
  xxl: 48,   // 48px - Extra extra large
  
  // Specific spacing values
  tiny: 2,
  gutter: 16,
  section: 40,
  
  // Helper function to get multiples of the base unit
  get: (multiple) => multiple * 4
};

// src/theme/typography.js
// Typography system

export const typography = {
  // Font families
  fontFamily: {
    base: 'System',  // System font
    accent: 'System' // System font for accents (could be replaced with a custom font)
  },
  
  // Font weights
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    bold: '700'
  },
  
  // Font sizes
  fontSize: {
    xs: 12,    // Extra small
    sm: 14,    // Small
    md: 16,    // Medium (base)
    lg: 18,    // Large
    xl: 20,    // Extra large
    xxl: 24,   // Extra extra large
    xxxl: 32,  // Display
    display2: 40 // Large display
  },
  
  // Line heights (multipliers)
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8
  },
  
  // Text styles
  text: {
    h1: {
      fontSize: 32,
      fontWeight: '700',
      lineHeight: 1.2
    },
    h2: {
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 1.2
    },
    h3: {
      fontSize: 20,
      fontWeight: '700',
      lineHeight: 1.3
    },
    h4: {
      fontSize: 18,
      fontWeight: '700',
      lineHeight: 1.3
    },
    h5: {
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 1.4
    },
    body1: {
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 1.5
    },
    body2: {
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 1.5
    },
    caption: {
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 1.4
    },
    button: {
      fontSize: 16,
      fontWeight: '500',
      lineHeight: 1.5,
      textTransform: 'none'
    }
  }
};

// src/theme/shadows.js
// Shadow styles for elevation

export const shadows = {
  none: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1,
    elevation: 1
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 6
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 8,
    elevation: 12
  }
};

// src/theme/borderRadius.js
// Border radius styles

export const borderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  circle: 9999
};

// src/theme/theme.js
// Main theme configuration

import { colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';
import { shadows } from './shadows';
import { borderRadius } from './borderRadius';

export const theme = {
  colors,
  spacing,
  typography,
  shadows,
  borderRadius
};

// src/theme/ThemeContext.js
// Theme provider and hooks

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme as defaultTheme } from './theme';

// Create theme context
const ThemeContext = createContext(null);

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
  const [themeMode, setThemeMode] = useState(ThemeMode.SYSTEM);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [theme, setTheme] = useState(defaultTheme);

  // Load saved theme preference
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

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (themeMode === ThemeMode.SYSTEM) {
        setIsDarkMode(colorScheme === 'dark');
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, [themeMode]);

  // Update dark mode based on theme mode
  useEffect(() => {
    const updateDarkMode = async () => {
      try {
        if (themeMode === ThemeMode.SYSTEM) {
          const colorScheme = Appearance.getColorScheme();
          setIsDarkMode(colorScheme === 'dark');
        } else {
          setIsDarkMode(themeMode === ThemeMode.DARK);
        }
      } catch (error) {
        console.error('Error updating dark mode:', error);
      }
    };
    
    updateDarkMode();
  }, [themeMode]);

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

// src/theme/styled.js
// Utility functions for consistent styling

import { StyleSheet } from 'react-native';
import { theme } from './theme';

/**
 * Create styles with theme
 * 
 * @param {Function} stylesCreator - Function that takes theme and returns styles
 * @returns {Object} StyleSheet object
 */
export const makeStyles = (stylesCreator) => {
  return () => {
    const styles = stylesCreator(theme);
    return StyleSheet.create(styles);
  };
};

/**
 * Gets color from theme
 * 
 * @param {string} path - Dot notation path to color (e.g. 'primary.main')
 * @returns {string} Color value
 */
export const getColor = (path) => {
  const parts = path.split('.');
  let value = theme.colors;
  
  for (const part of parts) {
    if (value[part] === undefined) {
      console.warn(`Color not found: ${path}`);
      return '#000000';
    }
    value = value[part];
  }
  
  return value;
};

/**
 * Get spacing value from theme
 * 
 * @param {number|string} value - Spacing value or key
 * @returns {number} Spacing in pixels
 */
export const getSpacing = (value) => {
  if (typeof value === 'number') {
    return theme.spacing.get(value);
  }
  
  if (theme.spacing[value] !== undefined) {
    return theme.spacing[value];
  }
  
  console.warn(`Spacing not found: ${value}`);
  return 0;
};

/**
 * Common style patterns
 */
export const commonStyles = {
  // Flex styles
  flex: {
    row: {
      flexDirection: 'row',
    },
    column: {
      flexDirection: 'column',
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    spaceBetween: {
      justifyContent: 'space-between',
    },
    grow: {
      flex: 1,
    },
  },
  
  // Text styles
  text: {
    h1: {
      ...theme.typography.text.h1,
      color: theme.colors.text.primary,
    },
    h2: {
      ...theme.typography.text.h2,
      color: theme.colors.text.primary,
    },
    h3: {
      ...theme.typography.text.h3,
      color: theme.colors.text.primary,
    },
    body1: {
      ...theme.typography.text.body1,
      color: theme.colors.text.primary,
    },
    body2: {
      ...theme.typography.text.body2,
      color: theme.colors.text.primary,
    },
    caption: {
      ...theme.typography.text.caption,
      color: theme.colors.text.secondary,
    },
  },
  
  // Container styles
  container: {
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background.default,
    },
    card: {
      backgroundColor: theme.colors.background.card,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      ...theme.shadows.sm,
    },
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background.default,
    },
  },
};

/**
 * Create common component styles
 */
export const createComponentStyles = () => ({
  // Button styles
  button: {
    base: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    primary: {
      backgroundColor: theme.colors.primary.main,
    },
    secondary: {
      backgroundColor: theme.colors.secondary.main,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.primary.main,
    },
    text: {
      backgroundColor: 'transparent',
    },
    disabled: {
      opacity: 0.6,
    },
    small: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    large: {
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
    },
  },
  
  // Input styles
  input: {
    container: {
      marginBottom: theme.spacing.md,
    },
    base: {
      height: 50,
      borderWidth: 1,
      borderColor: theme.colors.gray[300],
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.background.input,
      color: theme.colors.text.primary,
    },
    label: {
      ...theme.typography.text.body2,
      color: theme.colors.text.secondary,
      marginBottom: theme.spacing.xs,
    },
    error: {
      ...theme.typography.text.caption,
      color: theme.colors.error.main,
      marginTop: theme.spacing.xs,
    },
    focused: {
      borderColor: theme.colors.primary.main,
    },
    error: {
      borderColor: theme.colors.error.main,
    },
  },
  
  // Card styles
  card: {
    container: {
      backgroundColor: theme.colors.background.card,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    title: {
      ...theme.typography.text.h4,
      color: theme.colors.text.primary,
    },
    content: {
      marginBottom: theme.spacing.md,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: theme.spacing.sm,
    },
  },
});

// Export default styles
export const componentStyles = createComponentStyles();
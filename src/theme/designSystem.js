// src/theme/designSystem.js
// Comprehensive design system for consistent UI/UX

import { Dimensions, Platform } from 'react-native';
import { moderateScale, scale, verticalScale } from 'react-native-size-matters';

const { width, height } = Dimensions.get('window');

// Base design system
const designSystem = {
  // SPACING
  spacing: {
    xs: moderateScale(4),
    sm: moderateScale(8),
    md: moderateScale(16),
    lg: moderateScale(24),
    xl: moderateScale(32),
    xxl: moderateScale(48),
    xxxl: moderateScale(64),
  },
  
  // TYPOGRAPHY
  typography: {
    // Font family 
    fontFamily: {
      regular: Platform.OS === 'ios' ? 'System' : 'Roboto',
      medium: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
      bold: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
      light: Platform.OS === 'ios' ? 'System' : 'Roboto-Light',
    },
    
    // Font sizes
    fontSize: {
      xs: moderateScale(10),
      sm: moderateScale(12),
      md: moderateScale(14),
      lg: moderateScale(16),
      xl: moderateScale(18),
      xxl: moderateScale(20),
      xxxl: moderateScale(24),
      display: moderateScale(28),
      giant: moderateScale(32),
    },
    
    // Font weights
    fontWeight: {
      light: '300',
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      heavy: '800',
    },
    
    // Line heights
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.8,
    },
    
    // Letter spacing
    letterSpacing: {
      tight: -0.5,
      normal: 0,
      wide: 0.5,
      wider: 1,
    },
  },
  
  // COLORS - Light theme colors
  colors: {
    // Core colors
    primary: {
      lightest: '#E3F2FD',
      lighter: '#BBDEFB',
      light: '#64B5F6',
      main: '#2196F3',
      dark: '#1976D2',
      darker: '#0D47A1',
      contrastText: '#FFFFFF',
    },
    secondary: {
      lightest: '#E8F5E9',
      lighter: '#C8E6C9',
      light: '#81C784',
      main: '#4CAF50',
      dark: '#388E3C',
      darker: '#1B5E20',
      contrastText: '#FFFFFF',
    },
    error: {
      lightest: '#FFEBEE',
      lighter: '#FFCDD2',
      light: '#EF9A9A',
      main: '#F44336',
      dark: '#D32F2F',
      darker: '#B71C1C',
      contrastText: '#FFFFFF',
    },
    warning: {
      lightest: '#FFF8E1',
      lighter: '#FFECB3',
      light: '#FFD54F',
      main: '#FFC107',
      dark: '#FFA000',
      darker: '#FF6F00',
      contrastText: '#000000',
    },
    success: {
      lightest: '#E8F5E9',
      lighter: '#C8E6C9',
      light: '#81C784',
      main: '#4CAF50',
      dark: '#388E3C',
      darker: '#1B5E20',
      contrastText: '#FFFFFF',
    },
    info: {
      lightest: '#E1F5FE',
      lighter: '#B3E5FC',
      light: '#4FC3F7',
      main: '#03A9F4',
      dark: '#0288D1',
      darker: '#01579B',
      contrastText: '#FFFFFF',
    },
    
    // Text colors
    text: {
      primary: '#212121',
      secondary: '#757575',
      disabled: '#9E9E9E',
      hint: '#9E9E9E',
    },
    
    // Background colors
    background: {
      default: '#F5F7F8',
      paper: '#FFFFFF',
      card: '#FFFFFF',
      input: '#F9FAFB',
    },
    
    // Action colors
    action: {
      active: 'rgba(0, 0, 0, 0.54)',
      hover: 'rgba(0, 0, 0, 0.04)',
      selected: 'rgba(0, 0, 0, 0.08)',
      disabled: 'rgba(0, 0, 0, 0.26)',
      disabledBackground: 'rgba(0, 0, 0, 0.12)',
    },
    
    // Common colors
    common: {
      black: '#000000',
      white: '#FFFFFF',
    },
    
    // Gray color palette
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
      900: '#212121',
    },
    
    // Divider and border colors
    divider: 'rgba(0, 0, 0, 0.1)',
    border: 'rgba(0, 0, 0, 0.12)',
  },
  
  // SHADOWS
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    xs: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 7,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 12,
    },
  },
  
  // BORDER RADIUS
  borderRadius: {
    xs: moderateScale(2),
    sm: moderateScale(4),
    md: moderateScale(8),
    lg: moderateScale(12),
    xl: moderateScale(16),
    xxl: moderateScale(24),
    full: 9999,
  },
  
  // ANIMATION TIMING
  animation: {
    short: 150,
    standard: 300,
    long: 500,
  },
  
  // SCREEN DIMENSIONS
  screen: {
    width,
    height,
    isSmall: width < 375,
    isMedium: width >= 375 && width < 414,
    isLarge: width >= 414,
  },
  
  // Z-INDEX
  zIndex: {
    modal: 1000,
    overlay: 900,
    dropdown: 800,
    header: 700,
    footer: 600,
    popover: 500,
    tooltip: 400,
    content: 0,
  },
};

// Create dark theme colors override
const darkThemeColors = {
  // Core colors remain the same
  
  // Text colors
  text: {
    primary: '#FFFFFF',
    secondary: '#B0BEC5',
    disabled: '#78909C',
    hint: '#78909C',
  },
  
  // Background colors
  background: {
    default: '#121212',
    paper: '#1E1E1E',
    card: '#2D2D2D',
    input: '#333333',
  },
  
  // Action colors
  action: {
    active: 'rgba(255, 255, 255, 0.7)',
    hover: 'rgba(255, 255, 255, 0.1)',
    selected: 'rgba(255, 255, 255, 0.16)',
    disabled: 'rgba(255, 255, 255, 0.3)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)',
  },
  
  // Gray color palette
  gray: {
    50: '#2D2D2D',
    100: '#333333',
    200: '#424242',
    300: '#616161',
    400: '#757575',
    500: '#9E9E9E',
    600: '#BDBDBD',
    700: '#E0E0E0',
    800: '#EEEEEE',
    900: '#F5F5F5',
  },
  
  // Divider and border colors
  divider: 'rgba(255, 255, 255, 0.12)',
  border: 'rgba(255, 255, 255, 0.15)',
};

// Create high contrast theme colors override
const highContrastColors = {
  // Core colors with higher contrast
  primary: {
    ...designSystem.colors.primary,
    main: '#0D47A1', // Darker blue for better contrast
    contrastText: '#FFFFFF',
  },
  
  // Text colors with higher contrast
  text: {
    primary: '#000000',
    secondary: '#333333',
    disabled: '#555555',
    hint: '#555555',
  },
  
  // Higher contrast backgrounds
  background: {
    default: '#FFFFFF',
    paper: '#FFFFFF',
    card: '#FFFFFF',
    input: '#FFFFFF',
  },
  
  // Divider and border with higher contrast
  divider: 'rgba(0, 0, 0, 0.3)',
  border: 'rgba(0, 0, 0, 0.3)',
};

// Create high contrast dark theme colors
const highContrastDarkColors = {
  // Core colors with higher contrast for dark mode
  primary: {
    ...designSystem.colors.primary,
    main: '#64B5F6', // Lighter blue for better contrast on dark backgrounds
    contrastText: '#000000',
  },
  
  // Text colors with higher contrast for dark mode
  text: {
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
    disabled: '#BDBDBD',
    hint: '#BDBDBD',
  },
  
  // Higher contrast backgrounds for dark mode
  background: {
    default: '#000000',
    paper: '#000000',
    card: '#121212',
    input: '#121212',
  },
  
  // Divider and border with higher contrast for dark mode
  divider: 'rgba(255, 255, 255, 0.5)',
  border: 'rgba(255, 255, 255, 0.5)',
};

// Export themes
export const lightTheme = {
  ...designSystem,
  dark: false,
};

export const darkTheme = {
  ...designSystem,
  dark: true,
  colors: {
    ...designSystem.colors,
    ...darkThemeColors,
  },
};

export const highContrastLightTheme = {
  ...designSystem,
  dark: false,
  colors: {
    ...designSystem.colors,
    ...highContrastColors,
  },
};

export const highContrastDarkTheme = {
  ...designSystem,
  dark: true,
  colors: {
    ...designSystem.colors,
    ...darkThemeColors,
    ...highContrastDarkColors,
  },
};

export default designSystem;

// src/theme/ThemeContext.js
// Theme provider with accessibility support

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccessibility } from '../hooks/useAccessibility';
import { lightTheme, darkTheme, highContrastLightTheme, highContrastDarkTheme } from './designSystem';
import { NavigationDarkTheme, NavigationLightTheme } from '@react-navigation/native';

// Create context
const ThemeContext = createContext();

// Theme provider component
export const ThemeProvider = ({ children }) => {
  const colorScheme = useColorScheme();
  const { highContrast } = useAccessibility();
  const [themeType, setThemeType] = useState('system'); // 'system', 'light', 'dark'
  const [isLoading, setIsLoading] = useState(true);
  
  // Load saved theme preference
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('themePreference');
        if (savedTheme) {
          setThemeType(savedTheme);
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadThemePreference();
  }, []);
  
  // Save theme preference when it changes
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem('themePreference', themeType).catch(error => {
        console.error('Error saving theme preference:', error);
      });
    }
  }, [themeType, isLoading]);
  
  // Determine if dark mode should be used
  const shouldUseDarkMode = 
    themeType === 'dark' || (themeType === 'system' && colorScheme === 'dark');
  
  // Determine which theme to use based on settings
  const getTheme = () => {
    if (shouldUseDarkMode) {
      return highContrast ? highContrastDarkTheme : darkTheme;
    }
    return highContrast ? highContrastLightTheme : lightTheme;
  };
  
  // Get navigation theme
  const getNavigationTheme = () => {
    const baseNavigationTheme = shouldUseDarkMode ? NavigationDarkTheme : NavigationLightTheme;
    const theme = getTheme();
    
    return {
      ...baseNavigationTheme,
      colors: {
        ...baseNavigationTheme.colors,
        primary: theme.colors.primary.main,
        background: theme.colors.background.default,
        card: theme.colors.background.paper,
        text: theme.colors.text.primary,
        border: theme.colors.divider,
      },
    };
  };
  
  // Combine theme with navigation theme
  const theme = {
    ...getTheme(),
    navigation: getNavigationTheme(),
  };
  
  // Set theme type
  const setTheme = (type) => {
    setThemeType(type);
  };
  
  // Context value
  const contextValue = {
    theme,
    themeType,
    setTheme,
    isDark: shouldUseDarkMode,
  };
  
  // Provide theme context
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to use theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// src/components/ui/Text.js
// Typography component with theming

import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAccessibility } from '../../hooks/useAccessibility';

export const Text = ({
  children,
  variant = 'body1',
  color = 'textPrimary',
  align = 'left',
  weight = 'regular',
  style,
  ...rest
}) => {
  const { theme } = useTheme();
  const { fontScale } = useAccessibility();
  
  // Get variant style
  const getVariantStyle = () => {
    switch (variant) {
      case 'h1':
        return styles.h1;
      case 'h2':
        return styles.h2;
      case 'h3':
        return styles.h3;
      case 'h4':
        return styles.h4;
      case 'h5':
        return styles.h5;
      case 'h6':
        return styles.h6;
      case 'subtitle1':
        return styles.subtitle1;
      case 'subtitle2':
        return styles.subtitle2;
      case 'body1':
        return styles.body1;
      case 'body2':
        return styles.body2;
      case 'button':
        return styles.button;
      case 'caption':
        return styles.caption;
      case 'overline':
        return styles.overline;
      default:
        return styles.body1;
    }
  };
  
  // Get color style
  const getColorStyle = () => {
    switch (color) {
      case 'textPrimary':
        return { color: theme.colors.text.primary };
      case 'textSecondary':
        return { color: theme.colors.text.secondary };
      case 'primary':
        return { color: theme.colors.primary.main };
      case 'secondary':
        return { color: theme.colors.secondary.main };
      case 'error':
        return { color: theme.colors.error.main };
      case 'warning':
        return { color: theme.colors.warning.main };
      case 'info':
        return { color: theme.colors.info.main };
      case 'success':
        return { color: theme.colors.success.main };
      case 'disabled':
        return { color: theme.colors.text.disabled };
      case 'hint':
        return { color: theme.colors.text.hint };
      default:
        return { color: color }; // Custom color
    }
  };
  
  // Get alignment style
  const getAlignStyle = () => {
    return { textAlign: align };
  };
  
  // Get font weight style
  const getWeightStyle = () => {
    switch (weight) {
      case 'light':
        return { fontWeight: theme.typography.fontWeight.light };
      case 'regular':
        return { fontWeight: theme.typography.fontWeight.regular };
      case 'medium':
        return { fontWeight: theme.typography.fontWeight.medium };
      case 'semibold':
        return { fontWeight: theme.typography.fontWeight.semibold };
      case 'bold':
        return { fontWeight: theme.typography.fontWeight.bold };
      default:
        return { fontWeight: theme.typography.fontWeight.regular };
    }
  };
  
  const styles = StyleSheet.create({
    h1: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.giant * fontScale,
      fontWeight: theme.typography.fontWeight.bold,
      lineHeight: theme.typography.fontSize.giant * fontScale * theme.typography.lineHeight.tight,
      letterSpacing: theme.typography.letterSpacing.tight,
      marginVertical: theme.spacing.sm,
    },
    h2: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.display * fontScale,
      fontWeight: theme.typography.fontWeight.bold,
      lineHeight: theme.typography.fontSize.display * fontScale * theme.typography.lineHeight.tight,
      letterSpacing: theme.typography.letterSpacing.tight,
      marginVertical: theme.spacing.sm,
    },
    h3: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.xxxl * fontScale,
      fontWeight: theme.typography.fontWeight.bold,
      lineHeight: theme.typography.fontSize.xxxl * fontScale * theme.typography.lineHeight.tight,
      letterSpacing: theme.typography.letterSpacing.normal,
      marginVertical: theme.spacing.xs,
    },
    h4: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.xxl * fontScale,
      fontWeight: theme.typography.fontWeight.bold,
      lineHeight: theme.typography.fontSize.xxl * fontScale * theme.typography.lineHeight.tight,
      letterSpacing: theme.typography.letterSpacing.normal,
      marginVertical: theme.spacing.xs,
    },
    h5: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.xl * fontScale,
      fontWeight: theme.typography.fontWeight.medium,
      lineHeight: theme.typography.fontSize.xl * fontScale * theme.typography.lineHeight.normal,
      letterSpacing: theme.typography.letterSpacing.normal,
      marginVertical: theme.spacing.xs,
    },
    h6: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.lg * fontScale,
      fontWeight: theme.typography.fontWeight.medium,
      lineHeight: theme.typography.fontSize.lg * fontScale * theme.typography.lineHeight.normal,
      letterSpacing: theme.typography.letterSpacing.normal,
      marginVertical: theme.spacing.xs,
    },
    subtitle1: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.lg * fontScale,
      fontWeight: theme.typography.fontWeight.regular,
      lineHeight: theme.typography.fontSize.lg * fontScale * theme.typography.lineHeight.normal,
      letterSpacing: theme.typography.letterSpacing.normal,
    },
    subtitle2: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.md * fontScale,
      fontWeight: theme.typography.fontWeight.medium,
      lineHeight: theme.typography.fontSize.md * fontScale * theme.typography.lineHeight.normal,
      letterSpacing: theme.typography.letterSpacing.normal,
    },
    body1: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.md * fontScale,
      fontWeight: theme.typography.fontWeight.regular,
      lineHeight: theme.typography.fontSize.md * fontScale * theme.typography.lineHeight.normal,
      letterSpacing: theme.typography.letterSpacing.normal,
    },
    body2: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.sm * fontScale,
      fontWeight: theme.typography.fontWeight.regular,
      lineHeight: theme.typography.fontSize.sm * fontScale * theme.typography.lineHeight.normal,
      letterSpacing: theme.typography.letterSpacing.normal,
    },
    button: {
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: theme.typography.fontSize.md * fontScale,
      fontWeight: theme.typography.fontWeight.medium,
      lineHeight: theme.typography.fontSize.md * fontScale * theme.typography.lineHeight.normal,
      letterSpacing: theme.typography.letterSpacing.wide,
      textTransform: 'uppercase',
    },
    caption: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.sm * fontScale,
      fontWeight: theme.typography.fontWeight.regular,
      lineHeight: theme.typography.fontSize.sm * fontScale * theme.typography.lineHeight.normal,
      letterSpacing: theme.typography.letterSpacing.normal,
    },
    overline: {
      fontFamily: theme.typography.fontFamily.regular,
      fontSize: theme.typography.fontSize.xs * fontScale,
      fontWeight: theme.typography.fontWeight.medium,
      lineHeight: theme.typography.fontSize.xs * fontScale * theme.typography.lineHeight.normal,
      letterSpacing: theme.typography.letterSpacing.wider,
      textTransform: 'uppercase',
    },
  });
  
  return (
    <RNText
      style={[
        getVariantStyle(),
        getColorStyle(),
        getAlignStyle(),
        getWeightStyle(),
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
};
      
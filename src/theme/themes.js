// src/theme/themes.js
// Theme definitions for light and dark mode

import { Platform } from 'react-native';

// Color palette
const palette = {
  // Blue
  blue: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    200: '#90CAF9',
    300: '#64B5F6',
    400: '#42A5F5',
    500: '#2196F3',
    600: '#1E88E5',
    700: '#1976D2',
    800: '#1565C0',
    900: '#0D47A1',
  },
  // Gray
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
  // Error/Red
  error: {
    50: '#FFEBEE',
    100: '#FFCDD2',
    200: '#EF9A9A',
    300: '#E57373',
    400: '#EF5350',
    500: '#F44336',
    600: '#E53935',
    700: '#D32F2F',
    800: '#C62828',
    900: '#B71C1C',
  },
  // Success/Green
  success: {
    50: '#E8F5E9',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#4CAF50',
    600: '#43A047',
    700: '#388E3C',
    800: '#2E7D32',
    900: '#1B5E20',
  },
  // Warning/Orange
  warning: {
    50: '#FFF3E0',
    100: '#FFE0B2',
    200: '#FFCC80',
    300: '#FFB74D',
    400: '#FFA726',
    500: '#FF9800',
    600: '#FB8C00',
    700: '#F57C00',
    800: '#EF6C00',
    900: '#E65100',
  },
  // Info/Cyan
  info: {
    50: '#E0F7FA',
    100: '#B2EBF2',
    200: '#80DEEA',
    300: '#4DD0E1',
    400: '#26C6DA',
    500: '#00BCD4',
    600: '#00ACC1',
    700: '#0097A7',
    800: '#00838F',
    900: '#006064',
  },
  // Common
  common: {
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
  },
};

// Create shadows for different platform
const createShadow = (elevation) => {
  if (Platform.OS === 'android') {
    return { elevation };
  }

  // iOS shadows
  const height = elevation * 0.5;
  const opacity = (0.5 + 0.1 * elevation) / 5;
  
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height },
    shadowOpacity: opacity,
    shadowRadius: elevation * 0.8,
  };
};

// Base theme configuration
const baseTheme = {
  shadows: {
    none: {},
    xs: createShadow(1),
    sm: createShadow(2),
    md: createShadow(4),
    lg: createShadow(6),
    xl: createShadow(8),
  },
  shape: {
    borderRadius: 8,
    buttonBorderRadius: 10,
    cardBorderRadius: 12,
  },
  spacing: (multiplier = 1) => 8 * multiplier,
  typography: {
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
    fontWeights: {
      light: '300',
      regular: '400',
      medium: '500',
      bold: '700',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      h1: 28,
      h2: 24,
      h3: 20,
      h4: 18,
      h5: 16,
      h6: 14,
    },
  },
};

// Light theme
export const lightTheme = {
  ...baseTheme,
  colors: {
    primary: {
      main: palette.blue[500],
      light: palette.blue[300],
      dark: palette.blue[700],
      contrastText: palette.common.white,
      lightest: palette.blue[50],
    },
    secondary: {
      main: palette.info[500],
      light: palette.info[300],
      dark: palette.info[700],
      contrastText: palette.common.white,
      lightest: palette.info[50],
    },
    error: {
      main: palette.error[500],
      light: palette.error[300],
      dark: palette.error[700],
      contrastText: palette.common.white,
      lightest: palette.error[50],
    },
    warning: {
      main: palette.warning[500],
      light: palette.warning[300],
      dark: palette.warning[700],
      contrastText: palette.common.white,
      lightest: palette.warning[50],
    },
    info: {
      main: palette.info[500],
      light: palette.info[300],
      dark: palette.info[700],
      contrastText: palette.common.white,
      lightest: palette.info[50],
    },
    success: {
      main: palette.success[500],
      light: palette.success[300],
      dark: palette.success[700],
      contrastText: palette.common.white,
      lightest: palette.success[50],
    },
    text: {
      primary: palette.gray[900],
      secondary: palette.gray[700],
      disabled: palette.gray[500],
      hint: palette.gray[500],
    },
    background: {
      default: palette.gray[100],
      paper: palette.common.white,
      card: palette.common.white,
      input: palette.gray[50],
      highlighted: palette.blue[50],
    },
    action: {
      active: palette.blue[500],
      hover: 'rgba(33, 150, 243, 0.08)',
      selected: 'rgba(33, 150, 243, 0.16)',
      disabled: 'rgba(0, 0, 0, 0.26)',
      disabledBackground: 'rgba(0, 0, 0, 0.12)',
    },
    divider: palette.gray[300],
    border: palette.gray[300],
    gray: palette.gray,
    common: palette.common,
  },
  navigation: {
    dark: false,
    colors: {
      primary: palette.blue[500],
      background: palette.common.white,
      card: palette.common.white,
      text: palette.gray[900],
      border: palette.gray[300],
      notification: palette.error[500],
    },
  },
};

// Dark theme
export const darkTheme = {
  ...baseTheme,
  colors: {
    primary: {
      main: palette.blue[400],
      light: palette.blue[300],
      dark: palette.blue[600],
      contrastText: palette.common.white,
      lightest: 'rgba(33, 150, 243, 0.12)',
    },
    secondary: {
      main: palette.info[400],
      light: palette.info[300],
      dark: palette.info[600],
      contrastText: palette.common.white,
      lightest: 'rgba(0, 188, 212, 0.12)',
    },
    error: {
      main: palette.error[400],
      light: palette.error[300],
      dark: palette.error[600],
      contrastText: palette.common.white,
      lightest: 'rgba(244, 67, 54, 0.12)',
    },
    warning: {
      main: palette.warning[400],
      light: palette.warning[300],
      dark: palette.warning[600],
      contrastText: palette.common.white,
      lightest: 'rgba(255, 152, 0, 0.12)',
    },
    info: {
      main: palette.info[400],
      light: palette.info[300],
      dark: palette.info[600],
      contrastText: palette.common.white,
      lightest: 'rgba(0, 188, 212, 0.12)',
    },
    success: {
      main: palette.success[400],
      light: palette.success[300],
      dark: palette.success[600],
      contrastText: palette.common.white,
      lightest: 'rgba(76, 175, 80, 0.12)',
    },
    text: {
      primary: palette.gray[100],
      secondary: palette.gray[300],
      disabled: palette.gray[500],
      hint: palette.gray[500],
    },
    background: {
      default: palette.gray[900],
      paper: palette.gray[800],
      card: palette.gray[800],
      input: palette.gray[700],
      highlighted: 'rgba(33, 150, 243, 0.12)',
    },
    action: {
      active: palette.blue[400],
      hover: 'rgba(33, 150, 243, 0.08)',
      selected: 'rgba(33, 150, 243, 0.16)',
      disabled: 'rgba(255, 255, 255, 0.3)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
    },
    divider: palette.gray[700],
    border: palette.gray[700],
    gray: palette.gray,
    common: palette.common,
  },
  navigation: {
    dark: true,
    colors: {
      primary: palette.blue[400],
      background: palette.gray[900],
      card: palette.gray[800],
      text: palette.gray[100],
      border: palette.gray[700],
      notification: palette.error[400],
    },
  },
};

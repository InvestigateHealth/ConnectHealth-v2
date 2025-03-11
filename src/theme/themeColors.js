// src/theme/themeColors.js
// Centralized color definitions for the app

// Base palette
const palette = {
  // Primary blues
  blue: {
    50: '#EBF5FB',
    100: '#D6EAF8',
    200: '#AED6F1',
    300: '#85C1E9',
    400: '#5DADE2',
    500: '#3498DB', // Primary color
    600: '#2E86C1',
    700: '#2874A6',
    800: '#21618C',
    900: '#1A4F72',
  },
  
  // Gray scale
  gray: {
    50: '#F8F9FA',
    100: '#F1F3F4',
    200: '#E9ECEF',
    300: '#DEE2E6',
    400: '#CED4DA',
    500: '#ADB5BD',
    600: '#6C757D',
    700: '#495057',
    800: '#343A40',
    900: '#212529',
  },
  
  // Success greens
  green: {
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
  
  // Warning oranges/yellows
  yellow: {
    50: '#FFF8E1',
    100: '#FFECB3',
    200: '#FFE082',
    300: '#FFD54F',
    400: '#FFCA28',
    500: '#FFC107',
    600: '#FFB300',
    700: '#FFA000',
    800: '#FF8F00',
    900: '#FF6F00',
  },
  
  // Error/danger reds
  red: {
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
  
  // Info blues (lighter than primary)
  info: {
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
};

// Light theme colors
export const lightTheme = {
  colors: {
    // Brand colors
    primary: {
      lightest: palette.blue[50],
      light: palette.blue[300],
      main: palette.blue[500],
      dark: palette.blue[700],
      contrastText: '#FFFFFF',
    },
    
    // State colors
    success: {
      lightest: palette.green[50],
      light: palette.green[200],
      main: palette.green[500],
      dark: palette.green[700],
      contrastText: '#FFFFFF',
    },
    warning: {
      lightest: palette.yellow[50],
      light: palette.yellow[200],
      main: palette.yellow[500],
      dark: palette.yellow[700],
      contrastText: '#000000',
    },
    error: {
      lightest: palette.red[50],
      light: palette.red[200],
      main: palette.red[500],
      dark: palette.red[700],
      contrastText: '#FFFFFF',
    },
    info: {
      lightest: palette.info[50],
      light: palette.info[200],
      main: palette.info[500],
      dark: palette.info[700],
      contrastText: '#FFFFFF',
    },
    
    // Grays
    gray: {
      50: palette.gray[50],
      100: palette.gray[100],
      200: palette.gray[200],
      300: palette.gray[300],
      400: palette.gray[400],
      500: palette.gray[500],
      600: palette.gray[600],
      700: palette.gray[700],
      800: palette.gray[800],
      900: palette.gray[900],
    },
    
    // Text colors
    text: {
      primary: palette.gray[900],
      secondary: palette.gray[600],
      hint: palette.gray[500],
      disabled: palette.gray[400],
      inverse: '#FFFFFF',
    },
    
    // Background colors
    background: {
      default: '#F8F9FA',
      paper: '#FFFFFF',
      card: '#FFFFFF',
      highlighted: '#F0F7FF',
      input: '#F1F3F4',
    },
    
    // Other UI elements
    divider: palette.gray[200],
    border: palette.gray[300],
    
    // Action states
    action: {
      hover: 'rgba(0, 0, 0, 0.04)',
      selected: 'rgba(33, 150, 243, 0.08)',
      disabled: 'rgba(0, 0, 0, 0.26)',
      disabledBackground: 'rgba(0, 0, 0, 0.12)',
      focus: 'rgba(0, 0, 0, 0.12)',
    },
    
    // Common colors
    common: {
      white: '#FFFFFF',
      black: '#000000',
    },
  },
  
  // Shadows
  shadows: {
    none: {},
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.22,
      shadowRadius: 2.22,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
      elevation: 8,
    },
  },
  
  // Typography
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      bold: 'System',
    },
    fontSize: {
      xs: 10,
      sm: 12, 
      md: 14,
      lg: 16,
      xl: 18,
      '2xl': 20,
      '3xl': 24,
      '4xl': 30,
      '5xl': 36,
    },
  },
  
  // Spacing
  spacing: (factor) => 4 * factor,
  
  // Border radius
  shape: {
    borderRadius: {
      xs: 2,
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    },
  },
};

// Dark theme colors
export const darkTheme = {
  colors: {
    // Brand colors
    primary: {
      lightest: palette.blue[900],
      light: palette.blue[600],
      main: palette.blue[400],
      dark: palette.blue[200],
      contrastText: '#000000',
    },
    
    // State colors
    success: {
      lightest: '#0C3A17', // Darker green
      light: palette.green[700], 
      main: palette.green[400],
      dark: palette.green[200],
      contrastText: '#000000',
    },
    warning: {
      lightest: '#3A2A00', // Darker yellow
      light: palette.yellow[700],
      main: palette.yellow[400],
      dark: palette.yellow[200],
      contrastText: '#000000',
    },
    error: {
      lightest: '#3A0A0A', // Darker red
      light: palette.red[700],
      main: palette.red[400],
      dark: palette.red[200],
      contrastText: '#000000',
    },
    info: {
      lightest: '#001A33', // Darker blue
      light: palette.info[700],
      main: palette.info[400],
      dark: palette.info[200],
      contrastText: '#000000',
    },
    
    // Grays
    gray: {
      900: palette.gray[50],
      800: palette.gray[100],
      700: palette.gray[200],
      600: palette.gray[300],
      500: palette.gray[400],
      400: palette.gray[500],
      300: palette.gray[600],
      200: palette.gray[700],
      100: palette.gray[800],
      50: palette.gray[900],
    },
    
    // Text colors
    text: {
      primary: '#FFFFFF',
      secondary: palette.gray[400],
      hint: palette.gray[500],
      disabled: palette.gray[600],
      inverse: '#000000',
    },
    
    // Background colors
    background: {
      default: '#121212',
      paper: '#1E1E1E',
      card: '#2D2D2D',
      highlighted: '#1A2A3A',
      input: '#2D2D2D',
    },
    
    // Other UI elements
    divider: palette.gray[700],
    border: palette.gray[600],
    
    // Action states
    action: {
      hover: 'rgba(255, 255, 255, 0.08)',
      selected: 'rgba(33, 150, 243, 0.16)',
      disabled: 'rgba(255, 255, 255, 0.3)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
      focus: 'rgba(255, 255, 255, 0.12)',
    },
    
    // Common colors
    common: {
      white: '#FFFFFF',
      black: '#000000',
    },
  },
  
  // Shadows for dark theme (subtle)
  shadows: {
    none: {},
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.35,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 3,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45,
      shadowRadius: 5,
      elevation: 9,
    },
  },
  
  // Typography
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      bold: 'System',
    },
    fontSize: {
      xs: 10,
      sm: 12, 
      md: 14,
      lg: 16,
      xl: 18,
      '2xl': 20,
      '3xl': 24,
      '4xl': 30,
      '5xl': 36,
    },
  },
  
  // Spacing
  spacing: (factor) => 4 * factor,
  
  // Border radius
  shape: {
    borderRadius: {
      xs: 2,
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    },
  },
};

// High contrast theme for accessibility
export const highContrastTheme = {
  colors: {
    // Brand colors
    primary: {
      lightest: '#E6F7FF',
      light: '#66CFFF',
      main: '#0066CC', // High contrast blue
      dark: '#004499',
      contrastText: '#FFFFFF',
    },
    
    // State colors
    success: {
      lightest: '#E6FFE6',
      light: '#66FF66',
      main: '#008800', // High contrast green
      dark: '#006600',
      contrastText: '#FFFFFF',
    },
    warning: {
      lightest: '#FFF6E6',
      light: '#FFCC66',
      main: '#CC6600', // High contrast orange
      dark: '#994D00',
      contrastText: '#FFFFFF',
    },
    error: {
      lightest: '#FFE6E6',
      light: '#FF6666',
      main: '#CC0000', // High contrast red
      dark: '#990000',
      contrastText: '#FFFFFF',
    },
    
    // Text colors
    text: {
      primary: '#000000', // Maximum contrast
      secondary: '#333333',
      hint: '#666666',
      disabled: '#888888',
      inverse: '#FFFFFF',
    },
    
    // Background colors
    background: {
      default: '#FFFFFF', // Maximum contrast
      paper: '#FFFFFF',
      card: '#FFFFFF',
      highlighted: '#E6F0FF',
      input: '#FFFFFF',
    },
    
    // Other UI elements
    divider: '#000000',
    border: '#000000',
  },
};

export default {
  light: lightTheme,
  dark: darkTheme,
  highContrast: highContrastTheme
};

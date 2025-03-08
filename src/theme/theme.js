// src/theme/theme.js
// Theme configuration for light and dark modes

// Common colors shared between themes
const commonColors = {
  primary: {
    light: '#64B5F6',
    main: '#2196F3',
    dark: '#1976D2',
    contrastText: '#FFFFFF'
  },
  secondary: {
    light: '#4CAF50',
    main: '#388E3C',
    dark: '#2E7D32',
    contrastText: '#FFFFFF'
  },
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
  common: {
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent'
  }
};

// Spacing system
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48
};

// Typography system
export const typography = {
  fontFamily: {
    base: 'System',
    accent: 'System'
  },
  fontWeight: {
    light: '300',
    regular: '400',
    medium: '500',
    bold: '700'
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32
  }
};

// Shadow styles
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
  }
};

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

// Light theme
export const lightTheme = {
  colors: {
    ...commonColors,
    text: {
      primary: '#263238',
      secondary: '#546E7A',
      disabled: '#9E9E9E',
      hint: '#78909C'
    },
    background: {
      default: '#F5F7F8',
      paper: '#FFFFFF',
      card: '#FFFFFF',
      input: '#F5F7F8'
    },
    divider: '#ECEFF1',
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
    }
  },
  spacing,
  typography,
  shadows,
  borderRadius,
  dark: false
};

// Dark theme
export const darkTheme = {
  colors: {
    ...commonColors,
    text: {
      primary: '#FFFFFF',
      secondary: '#B0BEC5',
      disabled: '#78909C',
      hint: '#90A4AE'
    },
    background: {
      default: '#121212',
      paper: '#1E1E1E',
      card: '#2D2D2D',
      input: '#333333'
    },
    divider: 'rgba(255, 255, 255, 0.12)',
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
      900: '#F5F5F5'
    }
  },
  spacing,
  typography,
  shadows,
  borderRadius,
  dark: true
};

// Navigation theme for React Navigation
export const navigationTheme = {
  light: {
    dark: false,
    colors: {
      primary: lightTheme.colors.primary.main,
      background: lightTheme.colors.background.default,
      card: lightTheme.colors.background.paper,
      text: lightTheme.colors.text.primary,
      border: lightTheme.colors.divider,
      notification: lightTheme.colors.primary.main,
    },
  },
  dark: {
    dark: true,
    colors: {
      primary: darkTheme.colors.primary.main,
      background: darkTheme.colors.background.default,
      card: darkTheme.colors.background.paper,
      text: darkTheme.colors.text.primary,
      border: darkTheme.colors.divider,
      notification: darkTheme.colors.primary.main,
    },
  },
};

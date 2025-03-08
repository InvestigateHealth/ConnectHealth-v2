// src/styles/styles.js
// Reusable styles and theme configuration for consistent UI

import { StyleSheet, Dimensions, Platform, StatusBar } from 'react-native';

// Get device dimensions
export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Determine if device is iOS
export const IS_IOS = Platform.OS === 'ios';

// Get status bar height
export const STATUS_BAR_HEIGHT = IS_IOS ? 20 : StatusBar.currentHeight;

// Determine if device is an iPad or tablet
export const IS_TABLET = SCREEN_WIDTH > 768;

// App-wide color palette
export const COLORS = {
  // Primary brand colors
  primary: {
    lightest: '#E3F2FD',
    lighter: '#BBDEFB',
    light: '#64B5F6',
    main: '#2196F3',
    dark: '#1976D2',
    darker: '#0D47A1',
  },
  
  // Secondary color
  secondary: {
    lightest: '#E8F5E9',
    lighter: '#C8E6C9',
    light: '#81C784',
    main: '#4CAF50',
    dark: '#388E3C',
    darker: '#1B5E20',
  },
  
  // Alert/status colors
  error: {
    light: '#FFEBEE',
    main: '#F44336',
    dark: '#C62828',
  },
  warning: {
    light: '#FFF8E1',
    main: '#FFC107',
    dark: '#F57F17',
  },
  success: {
    light: '#E8F5E9',
    main: '#4CAF50',
    dark: '#2E7D32',
  },
  info: {
    light: '#E1F5FE',
    main: '#03A9F4',
    dark: '#0277BD',
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
    900: '#212121',
  },
  
  // Common colors
  common: {
    white: '#FFFFFF',
    black: '#000000',
    transparent: 'transparent',
  },
  
  // Text colors
  text: {
    primary: '#263238',
    secondary: '#546E7A',
    disabled: '#9E9E9E',
    hint: '#78909C',
    light: '#FFFFFF',
  },
  
  // Background colors
  background: {
    default: '#F5F7F8',
    paper: '#FFFFFF',
    card: '#FFFFFF',
    input: '#F5F7F8',
    dark: '#263238',
  },
  
  // Other UI elements
  divider: '#ECEFF1',
  border: '#E0E0E0',
  backdrop: 'rgba(0, 0, 0, 0.5)',
  shadow: '#000000',
};

// Typography
export const TYPOGRAPHY = {
  // Font families
  fontFamily: {
    regular: Platform.select({
      ios: 'System',
      android: 'Roboto',
    }),
    medium: Platform.select({
      ios: 'System',
      android: 'Roboto-Medium',
    }),
    bold: Platform.select({
      ios: 'System',
      android: 'Roboto-Bold',
    }),
    light: Platform.select({
      ios: 'System',
      android: 'Roboto-Light',
    }),
  },
  
  // Font sizes
  fontSize: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    xxxl: 24,
    display: 28,
    giant: 32,
  },
  
  // Line heights
  lineHeight: {
    xs: 14,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 28,
    xxl: 32,
    xxxl: 36,
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
};

// Spacing system
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Border radius
export const BORDER_RADIUS = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  circle: 9999,
};

// Shadow styles
export const SHADOWS = {
  none: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  
  xs: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  
  sm: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  
  md: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  
  lg: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 7,
    elevation: 8,
  },
  
  xl: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 12,
  },
};

// Z-index values
export const Z_INDEX = {
  base: 0,
  raised: 1,
  dropdown: 10,
  navbar: 100,
  modal: 1000,
  toast: 2000,
};

// Default animation durations
export const ANIMATION = {
  short: 150,
  medium: 300,
  long: 500,
};

// Utility function to generate dynamic spacing
export const spacing = (value) => {
  if (Array.isArray(value)) {
    return value.map(val => SPACING[val] || val).join(' ');
  }
  return SPACING[value] || value;
};

// Common styles
export const CommonStyles = StyleSheet.create({
  // Flex styles
  container: {
    flex: 1,
    backgroundColor: COLORS.background.default,
  },
  
  flexCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  flexBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  flexAround: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  
  flexWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  
  // Content alignment
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  alignStart: {
    alignItems: 'flex-start',
  },
  
  alignEnd: {
    alignItems: 'flex-end',
  },
  
  // Spacing
  padding: {
    padding: SPACING.md,
  },
  
  paddingHorizontal: {
    paddingHorizontal: SPACING.md,
  },
  
  paddingVertical: {
    paddingVertical: SPACING.md,
  },
  
  margin: {
    margin: SPACING.md,
  },
  
  marginHorizontal: {
    marginHorizontal: SPACING.md,
  },
  
  marginVertical: {
    marginVertical: SPACING.md,
  },
  
  // Card styles
  card: {
    backgroundColor: COLORS.background.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
    ...SHADOWS.sm,
  },
  
  cardElevated: {
    backgroundColor: COLORS.background.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
    ...SHADOWS.md,
  },
  
  // Text styles
  textCenter: {
    textAlign: 'center',
  },
  
  title: {
    fontSize: TYPOGRAPHY.fontSize.xxl,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
  },
  
  bodyText: {
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  
  captionText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text.secondary,
  },
  
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.error.main,
    marginTop: SPACING.xs,
  },
  
  // Input styles
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.md,
    color: COLORS.text.primary,
    backgroundColor: COLORS.background.input,
  },
  
  inputFocused: {
    borderColor: COLORS.primary.main,
  },
  
  inputError: {
    borderColor: COLORS.error.main,
  },
  
  // Button styles
  button: {
    height: 50,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  
  buttonPrimary: {
    backgroundColor: COLORS.primary.main,
  },
  
  buttonSecondary: {
    backgroundColor: COLORS.secondary.main,
  },
  
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary.main,
  },
  
  buttonText: {
    color: COLORS.common.white,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  
  buttonTextOutline: {
    color: COLORS.primary.main,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  
  buttonDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  
  buttonTextDisabled: {
    color: COLORS.text.disabled,
  },
  
  // Avatar styles
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.circle,
    backgroundColor: COLORS.gray[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  
  // Badge styles
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.circle,
    backgroundColor: COLORS.primary.main,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  badgeText: {
    color: COLORS.common.white,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    textAlign: 'center',
  },
  
  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: SPACING.md,
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.backdrop,
  },
  
  modalContent: {
    backgroundColor: COLORS.background.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '85%',
    maxWidth: 400,
    ...SHADOWS.lg,
  },
  
  // List styles
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  
  // Empty state styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  
  emptyStateText: {
    textAlign: 'center',
    marginTop: SPACING.md,
    color: COLORS.text.secondary,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  
  // Loading indicator
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Icon button
  iconButton: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.circle,
  },
});

// Helper function to create combined styles
export const createStyles = (...styles) => {
  return StyleSheet.flatten(styles);
};

// Helper function to create conditional styles
export const conditionalStyles = (condition, trueStyles, falseStyles = {}) => {
  return condition ? trueStyles : falseStyles;
};

// Dark mode colors (for theme support)
export const DARK_COLORS = {
  ...COLORS,
  text: {
    primary: '#FFFFFF',
    secondary: '#B0BEC5',
    disabled: '#78909C',
    hint: '#90A4AE',
    light: '#FFFFFF',
  },
  background: {
    default: '#121212',
    paper: '#1E1E1E',
    card: '#2D2D2D',
    input: '#333333',
    dark: '#000000',
  },
  divider: 'rgba(255, 255, 255, 0.12)',
  border: 'rgba(255, 255, 255, 0.15)',
};

// Responsive design helpers
export const getResponsiveWidth = (percent) => {
  return SCREEN_WIDTH * (percent / 100);
};

export const getResponsiveHeight = (percent) => {
  return SCREEN_HEIGHT * (percent / 100);
};

// Fonts for different platform
export const getFontFamily = (weight = 'regular', style = 'normal') => {
  if (Platform.OS === 'android') {
    // Android uses separate font files for different weights
    switch (weight) {
      case 'bold':
        return 'Roboto-Bold';
      case 'medium':
        return 'Roboto-Medium';
      case 'light':
        return 'Roboto-Light';
      case 'thin':
        return 'Roboto-Thin';
      default:
        return style === 'italic' ? 'Roboto-Italic' : 'Roboto-Regular';
    }
  }
  
  // iOS uses the system font with different weights
  let fontWeight;
  switch (weight) {
    case 'bold':
      fontWeight = '700';
      break;
    case 'medium':
      fontWeight = '500';
      break;
    case 'light':
      fontWeight = '300';
      break;
    case 'thin':
      fontWeight = '100';
      break;
    default:
      fontWeight = '400';
  }
  
  return {
    fontFamily: 'System',
    fontWeight,
    fontStyle: style,
  };
};

// Export theme for use with ThemeProvider
export const lightTheme = {
  colors: COLORS,
  fonts: TYPOGRAPHY,
  spacing: SPACING,
  borderRadius: BORDER_RADIUS,
  shadows: SHADOWS,
};

export const darkTheme = {
  colors: DARK_COLORS,
  fonts: TYPOGRAPHY,
  spacing: SPACING,
  borderRadius: BORDER_RADIUS,
  shadows: SHADOWS,
};

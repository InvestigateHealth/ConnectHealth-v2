// src/components/Badge.js
// Badge component for notifications, tags, status indicators

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';
import { useAccessibility } from '../hooks/useAccessibility';

/**
 * Badge component for labels, status indicators, and counters
 *
 * @param {Object} props
 * @param {string|number} props.label - Badge content
 * @param {string} props.variant - Badge variant (primary, secondary, success, warning, error, info)
 * @param {string} props.size - Badge size (small, medium, large)
 * @param {Object} props.style - Additional styles for the badge container
 * @param {Object} props.labelStyle - Additional styles for the badge text
 * @param {boolean} props.dot - Show as a dot instead of with label text
 * @param {boolean} props.outline - Show with outline style instead of filled
 * @param {string} props.testID - Test ID for testing
 */
const Badge = ({
  label,
  variant = 'primary',
  size = 'medium',
  style,
  labelStyle,
  dot = false,
  outline = false,
  testID,
  ...props
}) => {
  const { highContrast } = useAccessibility();

  // Get badge style based on variant
  const getBadgeStyle = () => {
    const baseStyle = outline ? styles.outlineBadge : styles.filledBadge;
    
    switch (variant) {
      case 'primary':
        return outline 
          ? { ...baseStyle, borderColor: theme.colors.primary.main } 
          : { ...baseStyle, backgroundColor: theme.colors.primary.light };
      case 'secondary':
        return outline 
          ? { ...baseStyle, borderColor: theme.colors.secondary.main } 
          : { ...baseStyle, backgroundColor: theme.colors.secondary.light };
      case 'success':
        return outline 
          ? { ...baseStyle, borderColor: theme.colors.success.main } 
          : { ...baseStyle, backgroundColor: theme.colors.success.light };
      case 'warning':
        return outline 
          ? { ...baseStyle, borderColor: theme.colors.warning.main } 
          : { ...baseStyle, backgroundColor: theme.colors.warning.light };
      case 'error':
        return outline 
          ? { ...baseStyle, borderColor: theme.colors.error.main } 
          : { ...baseStyle, backgroundColor: theme.colors.error.light };
      case 'info':
        return outline 
          ? { ...baseStyle, borderColor: theme.colors.info.main } 
          : { ...baseStyle, backgroundColor: theme.colors.info.light };
      default:
        return outline 
          ? { ...baseStyle, borderColor: theme.colors.primary.main } 
          : { ...baseStyle, backgroundColor: theme.colors.primary.light };
    }
  };

  // Get label style based on variant
  const getLabelStyle = () => {
    switch (variant) {
      case 'primary':
        return { color: outline ? theme.colors.primary.main : theme.colors.primary.dark };
      case 'secondary':
        return { color: outline ? theme.colors.secondary.main : theme.colors.secondary.dark };
      case 'success':
        return { color: outline ? theme.colors.success.main : theme.colors.success.dark };
      case 'warning':
        return { color: outline ? theme.colors.warning.main : theme.colors.warning.dark };
      case 'error':
        return { color: outline ? theme.colors.error.main : theme.colors.error.dark };
      case 'info':
        return { color: outline ? theme.colors.info.main : theme.colors.info.dark };
      default:
        return { color: outline ? theme.colors.primary.main : theme.colors.primary.dark };
    }
  };

  // Get size style
  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return dot ? styles.smallDot : styles.smallBadge;
      case 'large':
        return dot ? styles.largeDot : styles.largeBadge;
      default: // medium
        return dot ? styles.mediumDot : styles.mediumBadge;
    }
  };

  // Get label size style
  const getLabelSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallLabel;
      case 'large':
        return styles.largeLabel;
      default: // medium
        return styles.mediumLabel;
    }
  };

  // Handle high contrast mode
  const getHighContrastStyle = () => {
    if (!highContrast) return {};
    
    return {
      borderWidth: outline ? 2 : 1,
      borderColor: '#000000',
    };
  };

  // For accessibility
  const accessibilityProps = {
    accessible: true,
    accessibilityRole: 'text',
    accessibilityLabel: dot ? `${variant} indicator` : `${label} ${variant} badge`,
  };

  return (
    <View
      style={[
        getBadgeStyle(),
        getSizeStyle(),
        getHighContrastStyle(),
        style,
      ]}
      testID={testID || 'badge'}
      {...accessibilityProps}
      {...props}
    >
      {!dot && (
        <Text
          style={[
            styles.label,
            getLabelStyle(),
            getLabelSizeStyle(),
            highContrast && styles.highContrastText,
            labelStyle,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  filledBadge: {
    borderRadius: theme.borderRadius.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBadge: {
    borderRadius: theme.borderRadius.circle,
    borderWidth: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    minWidth: 16,
    height: 16,
  },
  mediumBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    minWidth: 20,
    height: 20,
  },
  largeBadge: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    minWidth: 24,
    height: 24,
  },
  smallDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mediumDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  largeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  label: {
    fontWeight: theme.typography.fontWeight.medium,
    textAlign: 'center',
  },
  smallLabel: {
    fontSize: theme.typography.fontSize.xs,
  },
  mediumLabel: {
    fontSize: theme.typography.fontSize.sm,
  },
  largeLabel: {
    fontSize: theme.typography.fontSize.md,
  },
  highContrastText: {
    fontWeight: 'bold',
  },
});

export default Badge;

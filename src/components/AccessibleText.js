// src/components/AccessibleText.js
// Accessible text component that respects user accessibility settings

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useAccessibility } from '../hooks/useAccessibility';
import { theme } from '../theme/theme';

/**
 * AccessibleText component that responds to accessibility settings
 * 
 * @param {Object} props
 * @param {ReactNode} props.children - Text content
 * @param {Object} props.style - Additional styles to apply
 * @param {string} props.variant - Text variant (h1, h2, h3, h4, body1, body2, caption)
 * @param {boolean} props.allowFontScaling - Whether to allow font scaling with system settings
 * @param {string} props.testID - Test ID for testing
 */
const AccessibleText = ({
  children,
  style,
  variant = 'body1',
  allowFontScaling = true,
  testID,
  ...props
}) => {
  const { fontScale, largeText, boldText, highContrast } = useAccessibility();
  
  // Get base style from variant
  const getBaseStyle = () => {
    switch (variant) {
      case 'h1':
        return styles.h1;
      case 'h2':
        return styles.h2;
      case 'h3':
        return styles.h3;
      case 'h4':
        return styles.h4;
      case 'body1':
        return styles.body1;
      case 'body2':
        return styles.body2;
      case 'caption':
        return styles.caption;
      default:
        return styles.body1;
    }
  };
  
  // Apply accessibility modifications
  const getAccessibilityStyle = () => {
    const accessibilityStyles = {};
    
    // Apply font scaling
    if (largeText) {
      accessibilityStyles.fontSize = getBaseStyle().fontSize * fontScale;
    }
    
    // Apply bold text if needed and not already a heading
    if (boldText && !['h1', 'h2', 'h3', 'h4'].includes(variant)) {
      accessibilityStyles.fontWeight = 'bold';
    }
    
    // Apply high contrast if enabled
    if (highContrast) {
      accessibilityStyles.color = '#000000';
    }
    
    return accessibilityStyles;
  };
  
  // Generate accessibility props
  const getAccessibilityProps = () => {
    return {
      accessible: true,
      accessibilityRole: variant.startsWith('h') ? 'header' : 'text',
      allowFontScaling,
      ...props
    };
  };
  
  return (
    <Text
      style={[getBaseStyle(), getAccessibilityStyle(), style]}
      testID={testID || `accessible-text-${variant}`}
      {...getAccessibilityProps()}
    >
      {children}
    </Text>
  );
};

// Base text styles
const styles = StyleSheet.create({
  h1: {
    fontSize: theme.typography.fontSize.xxxl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginVertical: theme.spacing.sm,
    lineHeight: theme.typography.fontSize.xxxl * theme.typography.lineHeight.tight,
  },
  h2: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginVertical: theme.spacing.sm,
    lineHeight: theme.typography.fontSize.xxl * theme.typography.lineHeight.tight,
  },
  h3: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginVertical: theme.spacing.xs,
    lineHeight: theme.typography.fontSize.xl * theme.typography.lineHeight.tight,
  },
  h4: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginVertical: theme.spacing.xs,
    lineHeight: theme.typography.fontSize.lg * theme.typography.lineHeight.normal,
  },
  body1: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.primary,
    lineHeight: theme.typography.fontSize.md * theme.typography.lineHeight.normal,
  },
  body2: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.normal,
  },
  caption: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.fontSize.xs * theme.typography.lineHeight.normal,
  },
});

export default AccessibleText;

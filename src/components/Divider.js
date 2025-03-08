// src/components/Divider.js
// Simple divider component with theming and accessibility

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';
import { useAccessibility } from '../hooks/useAccessibility';
import AccessibleText from './AccessibleText';

/**
 * Divider component for visually separating content
 * 
 * @param {Object} props
 * @param {string} props.orientation - Divider orientation (horizontal or vertical)
 * @param {string} props.variant - Divider variant (full, inset, middle)
 * @param {string} props.label - Optional text label to show in the middle of the divider
 * @param {string} props.thickness - Divider thickness in pixels
 * @param {string} props.color - Divider color
 * @param {Object} props.style - Additional styles for the divider
 * @param {Object} props.labelStyle - Additional styles for the label
 * @param {string} props.testID - Test ID for testing
 */
const Divider = ({
  orientation = 'horizontal',
  variant = 'full',
  label,
  thickness = 1,
  color,
  style,
  labelStyle,
  testID,
  ...props
}) => {
  const { highContrast } = useAccessibility();

  // Get orientation style
  const getOrientationStyle = () => {
    return orientation === 'vertical' ? styles.vertical : styles.horizontal;
  };

  // Get variant style
  const getVariantStyle = () => {
    switch (variant) {
      case 'inset':
        return orientation === 'vertical'
          ? styles.insetVertical
          : styles.insetHorizontal;
      case 'middle':
        return orientation === 'vertical'
          ? styles.middleVertical
          : styles.middleHorizontal;
      default: // full
        return {};
    }
  };

  // Get thickness and color
  const getAppearanceStyle = () => {
    const appearanceStyle = {};
    
    // Apply thickness
    if (orientation === 'vertical') {
      appearanceStyle.width = thickness;
    } else {
      appearanceStyle.height = thickness;
    }
    
    // Apply color or high contrast color
    if (highContrast) {
      appearanceStyle.backgroundColor = '#000000';
    } else if (color) {
      appearanceStyle.backgroundColor = color;
    }
    
    return appearanceStyle;
  };

  // For accessibility
  const accessibilityProps = {
    accessible: true,
    accessibilityRole: 'separator',
    accessibilityLabel: label || 'Divider',
  };

  // If a label is provided, render a labeled divider
  if (label && orientation === 'horizontal') {
    return (
      <View 
        style={[styles.labelContainer, style]} 
        testID={testID || 'labeled-divider'}
        {...accessibilityProps}
      >
        <View 
          style={[
            styles.horizontal, 
            getVariantStyle(), 
            getAppearanceStyle(),
            styles.labelDividerLeft
          ]} 
        />
        <AccessibleText
          variant="caption"
          style={[styles.label, labelStyle]}
        >
          {label}
        </AccessibleText>
        <View 
          style={[
            styles.horizontal, 
            getVariantStyle(), 
            getAppearanceStyle(),
            styles.labelDividerRight
          ]} 
        />
      </View>
    );
  }

  // Simple divider
  return (
    <View
      style={[
        getOrientationStyle(),
        getVariantStyle(),
        getAppearanceStyle(),
        style,
      ]}
      testID={testID || 'divider'}
      {...accessibilityProps}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  horizontal: {
    height: 1,
    backgroundColor: theme.colors.divider,
    alignSelf: 'stretch',
  },
  vertical: {
    width: 1,
    backgroundColor: theme.colors.divider,
    alignSelf: 'stretch',
  },
  insetHorizontal: {
    marginLeft: theme.spacing.lg,
    marginRight: theme.spacing.lg,
  },
  insetVertical: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  middleHorizontal: {
    marginLeft: theme.spacing.md,
    marginRight: theme.spacing.md,
  },
  middleVertical: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  label: {
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.text.secondary,
  },
  labelDividerLeft: {
    flex: 1,
  },
  labelDividerRight: {
    flex: 1,
  },
});

export default Divider;

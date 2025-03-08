// src/components/Card.js
// Reusable card component with theming and accessibility

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme/theme';
import { useAccessibility } from '../hooks/useAccessibility';
import AccessibleText from './AccessibleText';

/**
 * Card component with title, subtitle, and content sections
 * 
 * @param {Object} props
 * @param {ReactNode} props.children - Card content
 * @param {string} props.title - Card title
 * @param {string} props.subtitle - Card subtitle
 * @param {Function} props.onPress - Function to call when card is pressed
 * @param {Object} props.style - Additional styles for the card container
 * @param {Object} props.titleStyle - Additional styles for the title
 * @param {Object} props.subtitleStyle - Additional styles for the subtitle
 * @param {Object} props.contentStyle - Additional styles for the content area
 * @param {string} props.elevation - Shadow elevation (none, sm, md, lg)
 * @param {string} props.testID - Test ID for testing
 * @param {boolean} props.disabled - Whether the card is disabled
 */
const Card = ({
  children,
  title,
  subtitle,
  onPress,
  style,
  titleStyle,
  subtitleStyle,
  contentStyle,
  elevation = 'sm',
  testID,
  disabled = false,
  ...props
}) => {
  const { highContrast, reducedMotion } = useAccessibility();

  // Get shadow based on elevation
  const getShadowStyle = () => {
    if (reducedMotion || highContrast) {
      // Use border instead of shadow for reduced motion or high contrast
      return {
        borderWidth: 1,
        borderColor: highContrast ? '#000000' : theme.colors.gray[300],
        elevation: 0,
        shadowOpacity: 0,
      };
    }

    switch (elevation) {
      case 'none':
        return theme.shadows.none;
      case 'md':
        return theme.shadows.md;
      case 'lg':
        return theme.shadows.lg;
      default: // sm
        return theme.shadows.sm;
    }
  };

  // Combine styles
  const cardStyles = [
    styles.card,
    getShadowStyle(),
    disabled && styles.disabledCard,
    style,
  ];

  // Accessibility props
  const accessibilityProps = {
    accessible: true,
    accessibilityRole: onPress ? 'button' : 'none',
    accessibilityLabel: title,
    accessibilityHint: subtitle,
    accessibilityState: {
      disabled,
    },
  };

  // Render card header if title or subtitle exists
  const renderHeader = () => {
    if (title || subtitle) {
      return (
        <View style={styles.cardHeader}>
          {title && (
            <AccessibleText
              variant="h4"
              style={[styles.cardTitle, titleStyle]}
            >
              {title}
            </AccessibleText>
          )}
          {subtitle && (
            <AccessibleText
              variant="body2"
              style={[styles.cardSubtitle, subtitleStyle]}
            >
              {subtitle}
            </AccessibleText>
          )}
        </View>
      );
    }
    return null;
  };

  // Render main content
  const renderContent = () => (
    <View style={[styles.cardContent, contentStyle]}>
      {children}
    </View>
  );

  // Render card content based on whether it's pressable or not
  const renderCard = () => (
    <View 
      style={cardStyles} 
      testID={testID || 'card'}
      {...accessibilityProps}
      {...props}
    >
      {renderHeader()}
      {renderContent()}
    </View>
  );

  // If onPress is provided, wrap with TouchableOpacity
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={reducedMotion ? 0.9 : 0.7}
        disabled={disabled}
        testID={testID ? `${testID}-pressable` : 'pressable-card'}
        {...accessibilityProps}
      >
        {renderCard()}
      </TouchableOpacity>
    );
  }

  return renderCard();
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  disabledCard: {
    opacity: 0.7,
  },
  cardHeader: {
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  cardSubtitle: {
    color: theme.colors.text.secondary,
  },
  cardContent: {
    // No specific styling needed here
  },
});

export default Card;

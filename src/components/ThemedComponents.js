// src/components/ThemedComponents.js
// Reusable themed UI components

import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  StyleSheet 
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

/**
 * Themed Text component
 */
export const ThemedText = ({ 
  children, 
  style, 
  variant = 'body1', 
  color = 'primary',
  ...props 
}) => {
  const { theme } = useTheme();

  // Get variant style
  const getVariantStyle = () => {
    switch (variant) {
      case 'h1':
        return {
          fontSize: theme.typography.fontSize.xxxl,
          fontWeight: theme.typography.fontWeight.bold,
          marginBottom: theme.spacing.md,
        };
      case 'h2':
        return {
          fontSize: theme.typography.fontSize.xxl,
          fontWeight: theme.typography.fontWeight.bold,
          marginBottom: theme.spacing.sm,
        };
      case 'h3':
        return {
          fontSize: theme.typography.fontSize.xl,
          fontWeight: theme.typography.fontWeight.bold,
          marginBottom: theme.spacing.sm,
        };
      case 'subtitle1':
        return {
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.medium,
        };
      case 'subtitle2':
        return {
          fontSize: theme.typography.fontSize.md,
          fontWeight: theme.typography.fontWeight.medium,
        };
      case 'body2':
        return {
          fontSize: theme.typography.fontSize.sm,
        };
      case 'caption':
        return {
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.text.secondary,
        };
      case 'body1':
      default:
        return {
          fontSize: theme.typography.fontSize.md,
        };
    }
  };

  // Get color style
  const getColorStyle = () => {
    switch (color) {
      case 'secondary':
        return { color: theme.colors.text.secondary };
      case 'disabled':
        return { color: theme.colors.text.disabled };
      case 'hint':
        return { color: theme.colors.text.hint };
      case 'primary':
      default:
        return { color: theme.colors.text.primary };
    }
  };

  return (
    <Text 
      style={[getVariantStyle(), getColorStyle(), style]} 
      {...props}
    >
      {children}
    </Text>
  );
};

/**
 * Themed Button component
 */
export const ThemedButton = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  disabled = false,
  style,
  titleStyle,
  ...props
}) => {
  const { theme } = useTheme();

  // Get button style based on variant
  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: theme.colors.secondary.main,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.colors.primary.main,
        };
      case 'text':
        return {
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
        };
      case 'primary':
      default:
        return {
          backgroundColor: theme.colors.primary.main,
        };
    }
  };

  // Get title style based on variant
  const getTitleStyle = () => {
    switch (variant) {
      case 'outline':
        return {
          color: theme.colors.primary.main,
        };
      case 'text':
        return {
          color: theme.colors.primary.main,
        };
      case 'primary':
      case 'secondary':
      default:
        return {
          color: theme.colors.common.white,
        };
    }
  };

  // Get size style
  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.borderRadius.sm,
        };
      case 'large':
        return {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
        };
      case 'medium':
      default:
        return {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
        };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        getSizeStyle(),
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      {...props}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text
        style={[
          styles.buttonText,
          getTitleStyle(),
          size === 'small' && { fontSize: theme.typography.fontSize.sm },
          size === 'large' && { fontSize: theme.typography.fontSize.lg },
          titleStyle,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * Themed Card component
 */
export const ThemedCard = ({
  children,
  style,
  ...props
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.background.card,
          borderRadius: theme.borderRadius.md,
          ...theme.shadows.sm,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

/**
 * Themed TextInput component
 */
export const ThemedInput = ({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  secureTextEntry,
  style,
  ...props
}) => {
  const { theme } = useTheme();

  return (
    <View style={styles.inputContainer}>
      {label && (
        <Text
          style={[
            styles.inputLabel,
            { color: theme.colors.text.secondary },
          ]}
        >
          {label}
        </Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.hint}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.background.input,
            borderColor: error
              ? theme.colors.error.main
              : theme.colors.gray[300],
            color: theme.colors.text.primary,
          },
          style,
        ]}
        {...props}
      />
      {error && (
        <Text
          style={[
            styles.errorText,
            { color: theme.colors.error.main },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  iconContainer: {
    marginRight: 8,
  },
  card: {
    padding: 16,
    margin: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
});

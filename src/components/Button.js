// src/components/Button.js
// Reusable button component with theming

import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  View 
} from 'react-native';
import { theme } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';

/**
 * Button component with different variants
 */
export const Button = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  ...restProps
}) => {
  // Get button style based on variant
  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryButton;
      case 'secondary':
        return styles.secondaryButton;
      case 'outline':
        return styles.outlineButton;
      case 'text':
        return styles.textButton;
      default:
        return styles.primaryButton;
    }
  };
  
  // Get text style based on variant
  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
      case 'secondary':
        return styles.primaryButtonText;
      case 'outline':
        return styles.outlineButtonText;
      case 'text':
        return styles.textButtonText;
      default:
        return styles.primaryButtonText;
    }
  };
  
  // Get size style
  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallButton;
      case 'large':
        return styles.largeButton;
      default:
        return null;
    }
  };
  
  // Render icon
  const renderIcon = () => {
    if (!icon) return null;
    
    const iconColor = 
      variant === 'primary' || variant === 'secondary'
        ? theme.colors.common.white
        : variant === 'outline'
          ? theme.colors.primary.main
          : theme.colors.primary.main;
    
    return (
      <Icon 
        name={icon} 
        size={size === 'small' ? 16 : size === 'large' ? 24 : 20} 
        color={iconColor}
        style={[
          iconPosition === 'left' ? styles.iconLeft : styles.iconRight
        ]}
      />
    );
  };
  
  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        getSizeStyle(),
        disabled && styles.disabledButton,
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...restProps}
    >
      {loading ? (
        <ActivityIndicator 
          color={
            variant === 'primary' || variant === 'secondary'
              ? theme.colors.common.white
              : theme.colors.primary.main
          }
          size={size === 'small' ? 'small' : 'small'}
        />
      ) : (
        <View style={styles.contentContainer}>
          {icon && iconPosition === 'left' && renderIcon()}
          <Text 
            style={[
              getTextStyle(),
              getSizeStyle() === styles.smallButton ? styles.smallButtonText : null,
              getSizeStyle() === styles.largeButton ? styles.largeButtonText : null,
              textStyle
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && renderIcon()}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary.main,
  },
  secondaryButton: {
    backgroundColor: theme.colors.secondary.main,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.primary.main,
  },
  textButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: theme.spacing.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  smallButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  largeButton: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  primaryButtonText: {
    color: theme.colors.common.white,
    fontWeight: theme.typography.fontWeight.bold,
    fontSize: theme.typography.fontSize.md,
  },
  outlineButtonText: {
    color: theme.colors.primary.main,
    fontWeight: theme.typography.fontWeight.bold,
    fontSize: theme.typography.fontSize.md,
  },
  textButtonText: {
    color: theme.colors.primary.main,
    fontWeight: theme.typography.fontWeight.bold,
    fontSize: theme.typography.fontSize.md,
  },
  smallButtonText: {
    fontSize: theme.typography.fontSize.sm,
  },
  largeButtonText: {
    fontSize: theme.typography.fontSize.lg,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: theme.spacing.sm,
  },
  iconRight: {
    marginLeft: theme.spacing.sm,
  },
});

// src/components/TextInput.js
// Reusable text input component with theming

import React, { useState } from 'react';
import { 
  View, 
  TextInput as RNTextInput, 
  Text, 
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { theme } from '../theme/theme';
import Icon from 'react-native-vector-icons/Ionicons';

/**
 * TextInput component with theming
 */
export const TextInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry,
  icon,
  iconPosition = 'left',
  multiline = false,
  style,
  inputStyle,
  labelStyle,
  ...restProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureTextVisible, setIsSecureTextVisible] = useState(!secureTextEntry);
  
  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);
  
  const toggleSecureText = () => {
    setIsSecureTextVisible(!isSecureTextVisible);
  };
  
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.focusedInput,
        error && styles.errorInput,
        icon && iconPosition === 'left' && styles.inputWithLeftIcon,
        icon && iconPosition === 'right' && styles.inputWithRightIcon,
        secureTextEntry && styles.inputWithRightIcon,
      ]}>
        {icon && iconPosition === 'left' && (
          <Icon 
            name={icon} 
            size={20} 
            color={theme.colors.text.secondary}
            style={styles.leftIcon}
          />
        )}
        
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.text.hint}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry && !isSecureTextVisible}
          multiline={multiline}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            inputStyle
          ]}
          {...restProps}
        />
        
        {icon && iconPosition === 'right' && (
          <Icon 
            name={icon} 
            size={20} 
            color={theme.colors.text.secondary}
            style={styles.rightIcon}
          />
        )}
        
        {secureTextEntry && (
          <TouchableOpacity 
            onPress={toggleSecureText} 
            style={styles.rightIcon}
          >
            <Icon 
              name={isSecureTextVisible ? 'eye-off-outline' : 'eye-outline'} 
              size={20} 
              color={theme.colors.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
    fontWeight: theme.typography.fontWeight.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.input,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    color: theme.colors.text.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  focusedInput: {
    borderColor: theme.colors.primary.main,
  },
  errorInput: {
    borderColor: theme.colors.error.main,
  },
  errorText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error.main,
    marginTop: theme.spacing.xs,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  leftIcon: {
    padding: theme.spacing.md,
  },
  rightIcon: {
    padding: theme.spacing.md,
  },
});

// src/components/Card.js
// Reusable card component with theming

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { theme } from '../theme/theme';

/**
 * Card component with theming
 */
export const Card = ({
  children,
  title,
  subtitle,
  titleStyle,
  subtitleStyle,
  style,
  contentStyle,
  ...restProps
}) => {
  return (
    <View style={[styles.card, style]} {...restProps}>
      {(title || subtitle) && (
        <View style={styles.cardHeader}>
          {title && <Text style={[styles.cardTitle, titleStyle]}>{title}</Text>}
          {subtitle && <Text style={[styles.cardSubtitle, subtitleStyle]}>{subtitle}</Text>}
        </View>
      )}
      <View style={[styles.cardContent, contentStyle]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  cardHeader: {
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  cardSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  cardContent: {
    // No specific styling needed here
  },
});

// src/components/Avatar.js
// Reusable avatar component

import React from 'react';
import { View, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { theme } from '../theme/theme';

/**
 * Avatar component with placeholder
 */
export const Avatar = ({
  source,
  size = 'medium',
  onPress,
  style,
  ...restProps
}) => {
  // Calculate avatar size
  const getSize = () => {
    switch (size) {
      case 'small':
        return 36;
      case 'large':
        return 80;
      case 'xlarge':
        return 120;
      default: // medium
        return 50;
    }
  };

  // Calculate icon size
  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 18;
      case 'large':
        return 40;
      case 'xlarge':
        return 60;
      default: // medium
        return 25;
    }
  };

  const avatarSize = getSize();
  const iconSize = getIconSize();

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
        },
        styles.avatar,
        style,
      ]}
      onPress={onPress}
      {...restProps}
    >
      {source ? (
        <FastImage
          source={{ uri: source }}
          style={styles.image}
          resizeMode={FastImage.resizeMode.cover}
        />
      ) : (
        <View style={styles.placeholder}>
          <Icon name="person" size={iconSize} color="#FFFFFF" />
        </View>
      )}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: theme.colors.gray[500],
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// src/components/EmptyState.js
// Reusable empty state component

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Button } from './Button';
import { theme } from '../theme/theme';

/**
 * Empty state component for lists and screens
 */
export const EmptyState = ({
  icon,
  title,
  message,
  buttonTitle,
  onButtonPress,
  style,
  ...restProps
}) => {
  return (
    <View style={[styles.container, style]} {...restProps}>
      {icon && (
        <Icon name={icon} size={60} color={theme.colors.gray[400]} style={styles.icon} />
      )}
      
      {title && <Text style={styles.title}>{title}</Text>}
      
      {message && <Text style={styles.message}>{message}</Text>}
      
      {buttonTitle && onButtonPress && (
        <Button
          title={buttonTitle}
          onPress={onButtonPress}
          style={styles.button}
          variant="primary"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  icon: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  message: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  button: {
    marginTop: theme.spacing.md,
  },
});

// src/components/LoadingIndicator.js
// Reusable loading indicator with overlay option

import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { theme } from '../theme/theme';

/**
 * Loading indicator component
 */
export const LoadingIndicator = ({
  size = 'large',
  color = theme.colors.primary.main,
  overlay = false,
  text,
  style,
  ...restProps
}) => {
  if (overlay) {
    return (
      <View style={[styles.overlayContainer, style]} {...restProps}>
        <View style={styles.overlayContent}>
          <ActivityIndicator size={size} color={color} />
          {text && <Text style={styles.text}>{text}</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} {...restProps}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  overlayContent: {
    backgroundColor: 'white',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  text: {
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.fontSize.sm,
  },
});

// src/components/ErrorView.js
// Reusable error display component

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Button } from './Button';
import { theme } from '../theme/theme';

/**
 * Error display component
 */
export const ErrorView = ({
  error,
  onRetry,
  style,
  ...restProps
}) => {
  return (
    <View style={[styles.container, style]} {...restProps}>
      <Icon name="alert-circle-outline" size={60} color={theme.colors.error.main} style={styles.icon} />
      
      <Text style={styles.title}>Something went wrong</Text>
      
      {error && <Text style={styles.message}>{error}</Text>}
      
      {onRetry && (
        <Button
          title="Try Again"
          onPress={onRetry}
          style={styles.button}
          variant="primary"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  icon: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  message: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.error.main,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  button: {
    marginTop: theme.spacing.md,
  },
});

// src/components/ListItem.js
// Reusable list item component

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { theme } from '../theme/theme';

/**
 * List item component
 */
export const ListItem = ({
  title,
  subtitle,
  leftIcon,
  leftAvatar,
  rightIcon = 'chevron-forward',
  onPress,
  style,
  ...restProps
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      {...restProps}
    >
      {/* Left element (icon or avatar) */}
      {leftIcon && !leftAvatar && (
        <View style={styles.leftIcon}>
          <Icon name={leftIcon} size={24} color={theme.colors.text.secondary} />
        </View>
      )}
      
      {leftAvatar && (
        <View style={styles.leftAvatar}>
          <Avatar source={leftAvatar} size="small" />
        </View>
      )}
      
      {/* Content */}
      <View style={styles.content}>
        <Text 
          style={styles.title}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        
        {subtitle && (
          <Text 
            style={styles.subtitle}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        )}
      </View>
      
      {/* Right element (icon) */}
      {rightIcon && onPress && (
        <View style={styles.rightIcon}>
          <Icon name={rightIcon} size={20} color={theme.colors.gray[400]} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.card,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  leftIcon: {
    marginRight: theme.spacing.md,
  },
  leftAvatar: {
    marginRight: theme.spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  rightIcon: {
    marginLeft: theme.spacing.sm,
  },
});

// src/components/Divider.js
// Simple divider component

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

/**
 * Divider component
 */
export const Divider = ({ style, ...restProps }) => {
  return <View style={[styles.divider, style]} {...restProps} />;
};

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginVertical: theme.spacing.md,
  },
});

// src/components/Badge.js
// Badge component for notifications, tags, etc.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

/**
 * Badge component
 */
export const Badge = ({
  label,
  variant = 'primary',
  size = 'medium',
  style,
  labelStyle,
  ...restProps
}) => {
  // Get badge style based on variant
  const getBadgeStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryBadge;
      case 'secondary':
        return styles.secondaryBadge;
      case 'success':
        return styles.successBadge;
      case 'warning':
        return styles.warningBadge;
      case 'error':
        return styles.errorBadge;
      case 'info':
        return styles.infoBadge;
      default:
        return styles.primaryBadge;
    }
  };
  
  // Get label style based on variant
  const getLabelStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryLabel;
      case 'secondary':
        return styles.secondaryLabel;
      case 'success':
        return styles.successLabel;
      case 'warning':
        return styles.warningLabel;
      case 'error':
        return styles.errorLabel;
      case 'info':
        return styles.infoLabel;
      default:
        return styles.primaryLabel;
    }
  };
  
  // Get size style
  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallBadge;
      case 'large':
        return styles.largeBadge;
      default:
        return null;
    }
  };
  
  // Get label size style
  const getLabelSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallLabel;
      case 'large':
        return styles.largeLabel;
      default:
        return null;
    }
  };
  
  return (
    <View 
      style={[
        styles.badge,
        getBadgeStyle(),
        getSizeStyle(),
        style
      ]}
      {...restProps}
    >
      <Text 
        style={[
          styles.label,
          getLabelStyle(),
          getLabelSizeStyle(),
          labelStyle
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: theme.borderRadius.circle,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    alignSelf: 'flex-start',
  },
  primaryBadge: {
    backgroundColor: theme.colors.primary.light,
  },
  secondaryBadge: {
    backgroundColor: theme.colors.secondary.light,
  },
  successBadge: {
    backgroundColor: theme.colors.success.light,
  },
  warningBadge: {
    backgroundColor: theme.colors.warning.light,
  },
  errorBadge: {
    backgroundColor: theme.colors.error.light,
  },
  infoBadge: {
    backgroundColor: theme.colors.info.light,
  },
  smallBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  largeBadge: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  primaryLabel: {
    color: theme.colors.primary.dark,
  },
  secondaryLabel: {
    color: theme.colors.secondary.dark,
  },
  successLabel: {
    color: theme.colors.success.dark,
  },
  warningLabel: {
    color: theme.colors.warning.dark,
  },
  errorLabel: {
    color: theme.colors.error.dark,
  },
  infoLabel: {
    color: theme.colors.info.dark,
  },
  smallLabel: {
    fontSize: theme.typography.fontSize.xs,
  },
  largeLabel: {
    fontSize: theme.typography.fontSize.md,
  },
});
// src/components/Avatar.js
// Reusable avatar component with accessibility support

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { theme } from '../theme/theme';
import { useAccessibility } from '../hooks/useAccessibility';

/**
 * Avatar component with placeholder, various sizes and accessibility support
 *
 * @param {Object} props
 * @param {string} props.source - Image source URL
 * @param {string} props.size - Avatar size (small, medium, large, xlarge)
 * @param {Function} props.onPress - Function to call when avatar is pressed
 * @param {Object} props.style - Additional styles to apply
 * @param {string} props.testID - Test ID for testing
 * @param {string} props.accessibilityLabel - Accessibility label for screen readers
 */
const Avatar = ({
  source,
  size = 'medium',
  onPress,
  style,
  testID,
  accessibilityLabel,
  ...props
}) => {
  const { highContrast } = useAccessibility();

  // Calculate avatar size based on prop
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

  // Calculate icon size based on avatar size
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

  // Create container styles based on size and high contrast
  const containerStyle = [
    {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
      overflow: 'hidden',
    },
    highContrast && styles.highContrastBorder,
    style,
  ];

  // Accessibility props
  const accessibilityProps = {
    accessible: true,
    accessibilityRole: 'image',
    accessibilityLabel: accessibilityLabel || 'User avatar',
  };

  // Render component based on whether it's pressable or not
  const renderContent = () => (
    <View style={containerStyle} {...accessibilityProps} testID={testID || 'avatar'}>
      {source ? (
        <FastImage
          source={{ uri: source }}
          style={styles.image}
          resizeMode={FastImage.resizeMode.cover}
          defaultSource={require('../assets/default-avatar.png')}
        />
      ) : (
        <View style={styles.placeholder}>
          <Icon name="person" size={iconSize} color="#FFFFFF" />
        </View>
      )}
    </View>
  );

  // If onPress is provided, wrap with TouchableOpacity
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        {...accessibilityProps}
        testID={testID || 'pressable-avatar'}
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return renderContent();
};

const styles = StyleSheet.create({
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
  highContrastBorder: {
    borderWidth: 2,
    borderColor: '#000000',
  },
});

export default Avatar;

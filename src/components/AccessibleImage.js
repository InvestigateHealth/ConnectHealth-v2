// src/components/AccessibleImage.js
// Accessible image component that respects user accessibility settings

import React from 'react';
import { Image, View, StyleSheet, Platform } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useAccessibility } from '../hooks/useAccessibility';

/**
 * AccessibleImage component that respects accessibility settings
 * 
 * @param {Object} props - Component props
 * @param {Object|number} props.source - Image source (uri object or require)
 * @param {Object} props.style - Style for the image container
 * @param {string} props.contentDescription - Accessibility description for screen readers
 * @param {boolean} props.useFastImage - Whether to use FastImage for performance (default: true)
 * @param {string} props.resizeMode - Image resize mode (cover, contain, stretch, center)
 * @param {boolean} props.showBorder - Whether to show a border around the image
 * @returns {React.Component} Accessible image component
 */
const AccessibleImage = ({
  source,
  style,
  contentDescription,
  useFastImage = true,
  resizeMode = 'cover',
  showBorder = false,
  ...props
}) => {
  const { highContrast, grayscale, screenReaderEnabled } = useAccessibility();
  
  // Create wrapper styles based on accessibility settings
  const getWrapperStyle = () => {
    const wrapperStyles = [];
    
    if (showBorder || highContrast) {
      wrapperStyles.push(styles.highContrastBorder);
    }
    
    return wrapperStyles;
  };
  
  // Apply grayscale filter if needed
  const getFilterStyle = () => {
    if (grayscale && Platform.OS === 'ios') {
      // iOS supports filters through style
      return {
        filter: [{ saturate: 0 }], // Grayscale filter
      };
    }
    return {};
  };
  
  // Prepare accessibility props
  const accessibilityProps = {
    accessible: true,
    accessibilityLabel: contentDescription || 'Image',
    accessibilityRole: 'image',
    accessibilityHint: contentDescription ? undefined : 'Image without description',
  };
  
  // For Android, we need a different approach for grayscale
  const getAndroidGrayscaleStyle = () => {
    if (grayscale && Platform.OS === 'android') {
      return { tintColor: '#000', opacity: 0.5 };
    }
    return {};
  };
  
  // FastImage supports accessibility props directly
  if (useFastImage) {
    return (
      <View style={[styles.wrapper, ...getWrapperStyle(), style]}>
        <FastImage
          source={source}
          style={[styles.image, getFilterStyle(), getAndroidGrayscaleStyle()]}
          resizeMode={
            FastImage.resizeMode[
              resizeMode === 'cover'
                ? 'cover'
                : resizeMode === 'contain'
                ? 'contain'
                : resizeMode === 'stretch'
                ? 'stretch'
                : 'cover'
            ]
          }
          {...accessibilityProps}
          {...props}
        />
      </View>
    );
  }
  
  // Regular Image component
  return (
    <View style={[styles.wrapper, ...getWrapperStyle(), style]}>
      <Image
        source={source}
        style={[styles.image, getFilterStyle(), getAndroidGrayscaleStyle()]}
        resizeMode={resizeMode}
        {...accessibilityProps}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  highContrastBorder: {
    borderWidth: 2,
    borderColor: '#000000',
  },
});

export default AccessibleImage;

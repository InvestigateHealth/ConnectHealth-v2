// src/components/ui/CachedImage.js
// Enhanced image component with caching, progressive loading and error handling

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import FastImage from 'react-native-fast-image';
import { BlurView } from '@react-native-community/blur';
import { useTheme } from '../../theme/ThemeContext';
import { BLHeightWidth } from 'react-native-blurhash';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * Enhanced Image component with caching, progressive loading and error handling
 * 
 * @param {Object} props - Component props
 * @param {string} props.source - Image URI or source object
 * @param {string} props.blurhash - Blurhash string for placeholder
 * @param {string} props.thumbnailSource - Smaller version of image to show while loading
 * @param {Object} props.style - Image style
 * @param {string} props.resizeMode - Image resize mode
 * @param {Function} props.onLoad - Callback when image loads
 * @param {Function} props.onError - Callback when image fails to load
 * @param {boolean} props.showLoader - Whether to show loading indicator
 * @param {number} props.priority - Download priority
 * @param {string} props.placeholderColor - Placeholder color until image loads
 * @param {boolean} props.progressiveLoading - Whether to load progressive JPEG
 * @param {Object} props.imageContainerStyle - Style for the image container
 */
const CachedImage = ({
  source,
  blurhash,
  thumbnailSource,
  style,
  resizeMode = 'cover',
  onLoad,
  onError,
  showLoader = true,
  priority = FastImage.priority.normal,
  placeholderColor,
  progressiveLoading = true,
  imageContainerStyle,
  ...props
}) => {
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageOpacity] = useState(new Animated.Value(0));
  const [thumbnailOpacity] = useState(new Animated.Value(0));
  
  // Reset state when source changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    imageOpacity.setValue(0);
    thumbnailOpacity.setValue(0);
  }, [source, imageOpacity, thumbnailOpacity]);
  
  // Prepare source object
  const getSource = (uri) => {
    if (!uri) return null;
    
    if (typeof uri === 'string') {
      return { uri, priority, cache: FastImage.cacheControl.immutable };
    }
    
    if (uri.uri) {
      return {
        ...uri,
        priority,
        cache: uri.cache || FastImage.cacheControl.immutable
      };
    }
    
    return uri;
  };
  
  const mainSource = getSource(source);
  const thumbnail = getSource(thumbnailSource);
  
  // Determine resize mode
  const getFastImageResizeMode = () => {
    switch (resizeMode) {
      case 'contain':
        return FastImage.resizeMode.contain;
      case 'stretch':
        return FastImage.resizeMode.stretch;
      case 'center':
        return FastImage.resizeMode.center;
      default:
        return FastImage.resizeMode.cover;
    }
  };
  
  // Handle thumbnail load
  const handleThumbnailLoad = () => {
    Animated.timing(thumbnailOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };
  
  // Handle main image load
  const handleLoad = (e) => {
    setIsLoading(false);
    
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    
    if (onLoad) {
      onLoad(e);
    }
  };
  
  // Handle image error
  const handleError = (e) => {
    setIsLoading(false);
    setHasError(true);
    
    if (onError) {
      onError(e);
    }
  };
  
  // Prepare placeholder color
  const bgColor = placeholderColor || theme.colors.background.card;
  
  // Show error state
  if (hasError) {
    return (
      <View style={[styles.container, imageContainerStyle, style, { backgroundColor: bgColor }]}>
        <Icon
          name="image-off"
          size={24}
          color={theme.colors.text.secondary}
        />
      </View>
    );
  }
  
  return (
    <View style={[styles.container, imageContainerStyle, { backgroundColor: bgColor }]}>
      {blurhash && !hasError && (
        <View style={styles.absoluteFill}>
          <BLHeightWidth
            blurhash={blurhash}
            style={styles.absoluteFill}
          />
        </View>
      )}
      
      {thumbnailSource && !hasError && (
        <Animated.View style={[styles.absoluteFill, { opacity: thumbnailOpacity }]}>
          <FastImage
            source={thumbnail}
            style={styles.image}
            resizeMode={getFastImageResizeMode()}
            onLoad={handleThumbnailLoad}
          />
        </Animated.View>
      )}
      
      <Animated.View style={[styles.absoluteFill, { opacity: imageOpacity }]}>
        <FastImage
          source={mainSource}
          style={styles.image}
          resizeMode={getFastImageResizeMode()}
          onLoad={handleLoad}
          onError={handleError}
          progressiveRenderingEnabled={progressiveLoading}
          {...props}
        />
      </Animated.View>
      
      {isLoading && showLoader && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator
            size="small"
            color={theme.colors.primary.main}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CachedImage;

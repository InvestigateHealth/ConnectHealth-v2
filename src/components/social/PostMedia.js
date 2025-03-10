// src/components/social/PostMedia.js
// Component for displaying post media (images/videos) with carousel for multiple items

import React, { useState, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  ActivityIndicator,
  Pressable
} from 'react-native';
import CachedImage from '../ui/CachedImage';
import VideoPlayer from '../ui/VideoPlayer';
import { useTheme } from '../../theme/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width: screenWidth } = Dimensions.get('window');

/**
 * Component for displaying post media (images/videos) with carousel for multiple items
 * 
 * @param {Object} props - Component props
 * @param {Array} props.media - Array of media objects
 * @param {boolean} props.allowFullscreen - Whether to allow fullscreen mode
 * @param {Function} props.onFullscreen - Callback when fullscreen is requested
 * @param {Function} props.onMediaPress - Callback when media is pressed
 * @param {Object} props.style - Container style
 * @param {number} props.maxHeight - Maximum height of media container
 * @param {boolean} props.autoPlayVideos - Whether to autoplay videos
 * @param {boolean} props.showControls - Whether to show video controls
 * @param {Function} props.onLoad - Callback when all media has loaded
 */
const PostMedia = ({
  media = [],
  allowFullscreen = true,
  onFullscreen,
  onMediaPress,
  style,
  maxHeight = 400,
  autoPlayVideos = false,
  showControls = true,
  onLoad,
}) => {
  const { theme } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [loaded, setLoaded] = useState(Array(media.length).fill(false));
  const [error, setError] = useState(Array(media.length).fill(false));
  const scrollViewRef = useRef(null);
  
  // Skip rendering if no media
  if (!media || media.length === 0) return null;
  
  // Handle scroll event to update active index
  const handleScroll = (event) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const index = Math.round(contentOffset.x / screenWidth);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };
  
  // Handle media load
  const handleMediaLoad = (index) => {
    const newLoaded = [...loaded];
    newLoaded[index] = true;
    setLoaded(newLoaded);
    
    // Check if all media has loaded
    if (newLoaded.every(item => item) && onLoad) {
      onLoad();
    }
  };
  
  // Handle media error
  const handleMediaError = (index) => {
    const newError = [...error];
    newError[index] = true;
    setError(newError);
  };
  
  // Handle fullscreen request
  const handleFullscreenRequest = (index) => {
    if (allowFullscreen && onFullscreen) {
      onFullscreen(index);
    }
  };
  
  // Handle media press
  const handleMediaPress = (index) => {
    if (onMediaPress) {
      onMediaPress(index);
    } else if (allowFullscreen && onFullscreen) {
      onFullscreen(index);
    }
  };
  
  // Scroll to a specific index
  const scrollToIndex = (index) => {
    if (scrollViewRef.current && index >= 0 && index < media.length) {
      scrollViewRef.current.scrollTo({ x: index * screenWidth, animated: true });
    }
  };
  
  // Render indicator dots for carousel
  const renderDots = () => {
    if (media.length <= 1) return null;
    
    return (
      <View style={styles.dotsContainer}>
        {media.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dot,
              { 
                backgroundColor: index === activeIndex 
                  ? theme.colors.primary.main 
                  : theme.colors.background.card,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => scrollToIndex(index)}
            activeOpacity={0.8}
          />
        ))}
      </View>
    );
  };
  
  // Determine container dimensions
  const containerDimensions = {
    width: screenWidth,
    height: Math.min(screenWidth * 0.75, maxHeight),
  };
  
  // Render media item
  const renderMediaItem = (item, index) => {
    const { type, url, thumbnail, width: mediaWidth, height: mediaHeight } = item;
    
    // Skip rendering if no URL
    if (!url) return null;
    
    // Calculate aspect ratio if dimensions are available
    let aspectRatio = 1.33; // Default 4:3
    if (mediaWidth && mediaHeight && mediaWidth > 0 && mediaHeight > 0) {
      aspectRatio = mediaWidth / mediaHeight;
    }
    
    // Adjust dimensions based on aspect ratio
    const itemDimensions = { ...containerDimensions };
    
    if (aspectRatio > 1) {
      // Landscape
      itemDimensions.height = Math.min(screenWidth / aspectRatio, maxHeight);
    } else {
      // Portrait
      itemDimensions.height = Math.min(screenWidth * (1 / aspectRatio), maxHeight);
    }
    
    // Loading indicator
    if (!loaded[index] && !error[index]) {
      return (
        <View 
          key={`${url}-${index}`}
          style={[styles.mediaItem, { width: screenWidth, alignItems: 'center', justifyContent: 'center' }]}
        >
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      );
    }
    
    if (type === 'video') {
      return (
        <Pressable 
          key={`${url}-${index}`}
          style={[styles.mediaItem, { width: screenWidth }]}
          onPress={() => handleMediaPress(index)}
        >
          <VideoPlayer
            source={{ uri: url }}
            thumbnailUri={thumbnail}
            style={[styles.videoPlayer, itemDimensions]}
            autoPlay={autoPlayVideos && index === activeIndex}
            showControls={showControls}
            onLoad={() => handleMediaLoad(index)}
            onError={() => handleMediaError(index)}
            showFullscreenButton={allowFullscreen}
            onFullscreen={() => handleFullscreenRequest(index)}
            resizeMode="contain"
          />
        </Pressable>
      );
    }
    
    return (
      <Pressable 
        key={`${url}-${index}`}
        style={[styles.mediaItem, { width: screenWidth }]}
        onPress={() => handleMediaPress(index)}
      >
        <CachedImage
          source={{ uri: url }}
          style={[styles.image, itemDimensions]}
          resizeMode="contain"
          onLoad={() => handleMediaLoad(index)}
          onError={() => handleMediaError(index)}
          showLoader
        />
        
        {allowFullscreen && (
          <TouchableOpacity
            style={[
              styles.fullscreenButton,
              { backgroundColor: theme.colors.background.paper + '80' } // 50% opacity
            ]}
            onPress={() => handleFullscreenRequest(index)}
          >
            <Icon name="fullscreen" size={20} color={theme.colors.text.primary} />
          </TouchableOpacity>
        )}
      </Pressable>
    );
  };
  
  return (
    <View style={[styles.container, style]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={[styles.scrollView, containerDimensions]}
        contentContainerStyle={styles.scrollViewContent}
      >
        {media.map(renderMediaItem)}
      </ScrollView>
      
      {renderDots()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    alignItems: 'center',
  },
  mediaItem: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    borderWidth: 1,
  },
  fullscreenButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PostMedia;
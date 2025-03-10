// src/components/ui/VideoPlayer.js
// Enhanced video player with caching, controls, and error handling

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
} from 'react-native';
import Video from 'react-native-video';
import Slider from '@react-native-community/slider';
import { useTheme } from '../../theme/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FastImage from 'react-native-fast-image';
import { cacheVideo } from 'react-native-video-cache';
import { useAccessibility } from '../../hooks/useAccessibility';

/**
 * Format time in seconds to MM:SS
 * @param {number} timeInSeconds - Time in seconds
 * @returns {string} Formatted time
 */
const formatTime = (timeInSeconds) => {
  if (isNaN(timeInSeconds)) {
    return '00:00';
  }
  
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Enhanced video player component
 * 
 * @param {Object} props - Component props
 * @param {string} props.source - Video URI or source object
 * @param {string} props.thumbnailUri - Thumbnail image URI
 * @param {Object} props.style - Container style
 * @param {boolean} props.autoPlay - Whether to auto-play the video
 * @param {boolean} props.loop - Whether to loop the video
 * @param {boolean} props.muted - Whether the video is muted
 * @param {boolean} props.showControls - Whether to show video controls
 * @param {boolean} props.resizeMode - Video resize mode
 * @param {Function} props.onLoad - Callback when video loads
 * @param {Function} props.onEnd - Callback when video ends
 * @param {Function} props.onError - Callback when video fails to load
 * @param {Function} props.onPlaybackStatusUpdate - Callback for playback status updates
 * @param {boolean} props.showFullscreenButton - Whether to show fullscreen button
 * @param {Function} props.onFullscreen - Callback when fullscreen button is pressed
 */
const VideoPlayer = ({
  source,
  thumbnailUri,
  style,
  autoPlay = false,
  loop = false,
  muted = false,
  showControls = true,
  resizeMode = 'contain',
  onLoad,
  onEnd,
  onError,
  onPlaybackStatusUpdate,
  showFullscreenButton = true,
  onFullscreen,
  ...props
}) => {
  const { theme } = useTheme();
  const { reducedMotion } = useAccessibility();
  const videoRef = useRef(null);
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  // Animated values
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const thumbnailOpacity = useRef(new Animated.Value(1)).current;
  
  // Prepare source URL
  const getSource = () => {
    if (!source) return null;
    
    if (typeof source === 'string') {
      return { uri: source };
    }
    
    return source;
  };
  
  // Cache video when component mounts
  useEffect(() => {
    const prepareVideo = async () => {
      try {
        if (typeof source === 'string') {
          await cacheVideo(source);
        } else if (source && source.uri) {
          await cacheVideo(source.uri);
        }
      } catch (error) {
        console.warn('Video caching error:', error);
        // Continue anyway, as the video can still play without caching
      }
    };
    
    prepareVideo();
  }, [source]);
  
  // Auto-hide controls after a delay
  useEffect(() => {
    let timeout;
    
    if (isControlsVisible && videoLoaded && !isSeeking && isPlaying) {
      timeout = setTimeout(() => {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setIsControlsVisible(false);
        });
      }, 3000);
    }
    
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [isControlsVisible, controlsOpacity, videoLoaded, isSeeking, isPlaying]);
  
  // Toggle controls visibility
  const toggleControls = () => {
    if (isControlsVisible) {
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsControlsVisible(false);
      });
    } else {
      setIsControlsVisible(true);
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };
  
  // Toggle play/pause
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  // Handle load start
  const handleLoadStart = () => {
    setIsLoading(true);
  };
  
  // Handle video load
  const handleLoad = (data) => {
    setIsLoading(false);
    setVideoLoaded(true);
    setDuration(data.duration);
    
    // Fade out thumbnail
    Animated.timing(thumbnailOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
      delay: 300, // Small delay to ensure video is ready
    }).start();
    
    if (onLoad) {
      onLoad(data);
    }
    
    // Start playing if autoPlay is true
    if (autoPlay && !reducedMotion) {
      setIsPlaying(true);
    }
  };
  
  // Handle playback status update
  const handleProgress = (data) => {
    if (!isSeeking) {
      setCurrentTime(data.currentTime);
    }
    
    if (onPlaybackStatusUpdate) {
      onPlaybackStatusUpdate(data);
    }
  };
  
  // Handle end of video
  const handleEnd = () => {
    setIsPlaying(false);
    setCurrentTime(duration);
    
    if (onEnd) {
      onEnd();
    }
    
    if (loop) {
      videoRef.current.seek(0);
      setCurrentTime(0);
      setIsPlaying(true);
    }
  };
  
  // Handle video error
  const handleError = (error) => {
    setIsLoading(false);
    setHasError(true);
    setErrorMessage(error.error.errorString || 'Failed to load video');
    
    if (onError) {
      onError(error);
    }
  };
  
  // Seek to position
  const seekTo = (value) => {
    if (videoRef.current) {
      videoRef.current.seek(value);
      setCurrentTime(value);
    }
  };
  
  // Handle slider value change
  const handleSlidingStart = () => {
    setIsSeeking(true);
  };
  
  // Handle slider value change complete
  const handleSlidingComplete = (value) => {
    seekTo(value);
    setIsSeeking(false);
  };
  
  // Handle fullscreen button press
  const handleFullscreen = () => {
    if (onFullscreen) {
      onFullscreen();
    }
  };
  
  // Render loading indicator
  const renderLoading = () => {
    if (!isLoading) return null;
    
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
      </View>
    );
  };
  
  // Render error message
  const renderError = () => {
    if (!hasError) return null;
    
    return (
      <View style={styles.errorContainer}>
        <Icon name="error-outline" size={40} color={theme.colors.error.main} />
        <Text style={[styles.errorText, { color: theme.colors.error.main }]}>
          {errorMessage || 'Failed to load video'}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.colors.primary.main }]}
          onPress={() => {
            setHasError(false);
            setIsLoading(true);
            // Force video reload
            if (videoRef.current) {
              videoRef.current.reload();
            }
          }}
        >
          <Text style={[styles.retryText, { color: theme.colors.primary.contrastText }]}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  // Render controls
  const renderControls = () => {
    if (!showControls || !isControlsVisible) return null;
    
    return (
      <Animated.View 
        style={[
          styles.controlsContainer,
          { opacity: controlsOpacity, backgroundColor: 'rgba(0, 0, 0, 0.4)' }
        ]}
      >
        <View style={styles.topControls}>
          {showFullscreenButton && (
            <TouchableOpacity
              style={styles.fullscreenButton}
              onPress={handleFullscreen}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="fullscreen" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.centerControls}>
          <TouchableOpacity 
            style={styles.playPauseButton}
            onPress={togglePlayPause}
          >
            <Icon
              name={isPlaying ? 'pause' : 'play-arrow'}
              size={42}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.bottomControls}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration}
            value={currentTime}
            minimumTrackTintColor={theme.colors.primary.main}
            maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
            thumbTintColor={theme.colors.primary.main}
            onSlidingStart={handleSlidingStart}
            onSlidingComplete={handleSlidingComplete}
          />
          
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </Animated.View>
    );
  };
  
  // Render thumbnail
  const renderThumbnail = () => {
    if (!thumbnailUri || !isLoading) return null;
    
    return (
      <Animated.View 
        style={[
          styles.thumbnailContainer,
          { opacity: thumbnailOpacity }
        ]}
      >
        <FastImage
          source={{ uri: thumbnailUri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        
        <View style={styles.thumbnailOverlay}>
          <TouchableOpacity 
            style={styles.playButton}
            onPress={togglePlayPause}
          >
            <Icon name="play-arrow" size={48} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };
  
  return (
    <View style={[styles.container, style]}>
      {/* Video */}
      <Pressable style={styles.videoContainer} onPress={toggleControls}>
        <Video
          ref={videoRef}
          source={getSource()}
          style={styles.video}
          resizeMode={resizeMode}
          onLoadStart={handleLoadStart}
          onLoad={handleLoad}
          onProgress={handleProgress}
          onEnd={handleEnd}
          onError={handleError}
          paused={!isPlaying}
          repeat={loop}
          muted={muted}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          progressUpdateInterval={250}
          bufferConfig={{
            minBufferMs: 15000,
            maxBufferMs: 50000,
            bufferForPlaybackMs: 2500,
            bufferForPlaybackAfterRebufferMs: 5000
          }}
          {...props}
        />
// src/contexts/AccessibilityContext.js
// Enhanced accessibility context for better app usability

import React, { createContext, useState, useEffect, useContext } from 'react';
import { AccessibilityInfo, Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsService } from '../services/AnalyticsService';

// Create the context
const AccessibilityContext = createContext();

export const AccessibilityProvider = ({ children }) => {
  // Main accessibility states
  const [isVoiceOverEnabled, setIsVoiceOverEnabled] = useState(false);
  const [isBoldTextEnabled, setIsBoldTextEnabled] = useState(false);
  const [isGrayscaleEnabled, setIsGrayscaleEnabled] = useState(false);
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false);
  const [isReduceTransparencyEnabled, setIsReduceTransparencyEnabled] = useState(false);
  const [isInvertColorsEnabled, setIsInvertColorsEnabled] = useState(false);
  
  // App-specific accessibility preferences that can be toggled by the user
  const [largeFontScale, setLargeFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);
  const [simplifiedUI, setSimplifiedUI] = useState(false);
  const [alwaysShowLabels, setAlwaysShowLabels] = useState(false);
  const [reduceAnimations, setReduceAnimations] = useState(false);
  
  // Initialize by loading device settings and user preferences
  useEffect(() => {
    const initializeAccessibility = async () => {
      try {
        // Check system screen reader (VoiceOver/TalkBack)
        AccessibilityInfo.isScreenReaderEnabled().then(enabled => {
          setIsVoiceOverEnabled(enabled);
        });
        
        // Set up event listeners for accessibility changes
        const screenReaderListener = AccessibilityInfo.addEventListener(
          'screenReaderChanged',
          setIsVoiceOverEnabled
        );
        
        // Check other accessibility features when supported by platform
        if (Platform.OS === 'ios') {
          Promise.all([
            AccessibilityInfo.isBoldTextEnabled(),
            AccessibilityInfo.isGrayscaleEnabled(),
            AccessibilityInfo.isReduceMotionEnabled(),
            AccessibilityInfo.isReduceTransparencyEnabled(),
            AccessibilityInfo.isInvertColorsEnabled()
          ]).then(([boldText, grayscale, reduceMotion, reduceTransparency, invertColors]) => {
            setIsBoldTextEnabled(boldText);
            setIsGrayscaleEnabled(grayscale);
            setIsReduceMotionEnabled(reduceMotion);
            setIsReduceTransparencyEnabled(reduceTransparency);
            setIsInvertColorsEnabled(invertColors);
          });
          
          // Set up listeners for each feature
          const boldTextListener = AccessibilityInfo.addEventListener(
            'boldTextChanged',
            setIsBoldTextEnabled
          );
          
          const grayscaleListener = AccessibilityInfo.addEventListener(
            'grayscaleChanged',
            setIsGrayscaleEnabled
          );
          
          const reduceMotionListener = AccessibilityInfo.addEventListener(
            'reduceMotionChanged',
            setIsReduceMotionEnabled
          );
          
          const reduceTransparencyListener = AccessibilityInfo.addEventListener(
            'reduceTransparencyChanged',
            setIsReduceTransparencyEnabled
          );
          
          const invertColorsListener = AccessibilityInfo.addEventListener(
            'invertColorsChanged',
            setIsInvertColorsEnabled
          );
        } else {
          // On Android, only some features are available
          AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
            setIsReduceMotionEnabled(enabled);
          });
          
          const reduceMotionListener = AccessibilityInfo.addEventListener(
            'reduceMotionChanged',
            setIsReduceMotionEnabled
          );
        }
        
        // Load user preferences from storage
        const userPrefs = await loadUserPreferences();
        
        // Apply loaded preferences
        if (userPrefs) {
          setLargeFontScale(userPrefs.largeFontScale || 1);
          setHighContrast(userPrefs.highContrast || false);
          setSimplifiedUI(userPrefs.simplifiedUI || false);
          setAlwaysShowLabels(userPrefs.alwaysShowLabels || false);
          setReduceAnimations(userPrefs.reduceAnimations || false);
        }
        
        // Log accessibility features for analytics
        logAccessibilityStatus();
        
        // Return cleanup function for iOS listeners
        return () => {
          screenReaderListener.remove();
          
          if (Platform.OS === 'ios') {
            boldTextListener.remove();
            grayscaleListener.remove();
            reduceMotionListener.remove();
            reduceTransparencyListener.remove();
            invertColorsListener.remove();
          } else {
            reduceMotionListener.remove();
          }
        };
      } catch (error) {
        console.error('Error initializing accessibility context:', error);
        AnalyticsService.logError(error, { context: 'initialize_accessibility' });
      }
    };
    
    initializeAccessibility();
  }, []);
  
  // Load user preferences from AsyncStorage
  const loadUserPreferences = async () => {
    try {
      const prefsJson = await AsyncStorage.getItem('accessibilityPreferences');
      return prefsJson ? JSON.parse(prefsJson) : null;
    } catch (error) {
      console.error('Error loading accessibility preferences:', error);
      return null;
    }
  };
  
  // Save user preferences to AsyncStorage
  const saveUserPreferences = async () => {
    try {
      const preferences = {
        largeFontScale,
        highContrast,
        simplifiedUI,
        alwaysShowLabels,
        reduceAnimations,
      };
      
      await AsyncStorage.setItem('accessibilityPreferences', JSON.stringify(preferences));
      
      // Log saved preferences
      AnalyticsService.logEvent('accessibility_preferences_saved', preferences);
      
      return true;
    } catch (error) {
      console.error('Error saving accessibility preferences:', error);
      AnalyticsService.logError(error, { context: 'save_accessibility_preferences' });
      return false;
    }
  };
  
  // Log accessibility status to analytics
  const logAccessibilityStatus = () => {
    AnalyticsService.logEvent('accessibility_status', {
      screenReader: isVoiceOverEnabled,
      boldText: isBoldTextEnabled,
      grayscale: isGrayscaleEnabled,
      reduceMotion: isReduceMotionEnabled,
      reduceTransparency: isReduceTransparencyEnabled,
      invertColors: isInvertColorsEnabled,
      largeFontScale,
      highContrast,
      simplifiedUI,
      alwaysShowLabels,
      reduceAnimations,
    });
  };
  
  // Update font scale
  const updateFontScale = async (scale) => {
    setLargeFontScale(scale);
    await saveUserPreferences();
  };
  
  // Toggle high contrast mode
  const toggleHighContrast = async () => {
    setHighContrast(!highContrast);
    await saveUserPreferences();
  };
  
  // Toggle simplified UI
  const toggleSimplifiedUI = async () => {
    setSimplifiedUI(!simplifiedUI);
    await saveUserPreferences();
  };
  
  // Toggle always show labels
  const toggleAlwaysShowLabels = async () => {
    setAlwaysShowLabels(!alwaysShowLabels);
    await saveUserPreferences();
  };
  
  // Toggle reduce animations
  const toggleReduceAnimations = async () => {
    setReduceAnimations(!reduceAnimations);
    await saveUserPreferences();
  };
  
  // Reset all user preferences to defaults
  const resetPreferences = async () => {
    setLargeFontScale(1);
    setHighContrast(false);
    setSimplifiedUI(false);
    setAlwaysShowLabels(false);
    setReduceAnimations(false);
    
    await saveUserPreferences();
  };
  
  // Determine if animations should be shown based on system and user preferences
  const shouldShowAnimations = !isReduceMotionEnabled && !reduceAnimations;
  
  // Generate font size modifier based on scale
  const getFontSizeModifier = (baseSize) => {
    return baseSize * largeFontScale;
  };
  
  // Helper function to set accessible properties on views
  const withAccessibilityProps = (props = {}) => {
    const {
      label,
      hint,
      role,
      testID,
      disabled,
      ...otherProps
    } = props;
    
    return {
      accessible: true,
      accessibilityLabel: label,
      accessibilityHint: hint,
      accessibilityRole: role,
      accessibilityState: {
        disabled: !!disabled,
        ...props.accessibilityState
      },
      testID: testID || label,
      ...otherProps
    };
  };

  return (
    <AccessibilityContext.Provider
      value={{
        // System accessibility states
        isVoiceOverEnabled,
        isBoldTextEnabled,
        isGrayscaleEnabled,
        isReduceMotionEnabled,
        isReduceTransparencyEnabled,
        isInvertColorsEnabled,
        
        // User preferences
        largeFontScale,
        highContrast,
        simplifiedUI,
        alwaysShowLabels,
        reduceAnimations,
        
        // Helper functions
        updateFontScale,
        toggleHighContrast,
        toggleSimplifiedUI,
        toggleAlwaysShowLabels,
        toggleReduceAnimations,
        resetPreferences,
        shouldShowAnimations,
        getFontSizeModifier,
        withAccessibilityProps,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

// Custom hook to use the accessibility context
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

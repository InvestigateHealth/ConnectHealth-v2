// src/hooks/useAccessibility.js
// Custom hook for managing accessibility settings

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { AccessibilityInfo, Platform } from 'react-native';

// Default settings
const DEFAULT_SETTINGS = {
  largeText: false,
  boldText: false,
  highContrast: false,
  reducedMotion: false,
  screenReaderEnabled: false
};

export const useAccessibility = () => {
  const { updateAccessibilitySettings } = useTheme();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [initialized, setInitialized] = useState(false);

  // Load settings from storage
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettings = await AsyncStorage.getItem('accessibilitySettings');
        
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings);
          setSettings(prevSettings => ({
            ...prevSettings,
            ...parsedSettings
          }));
        }
        
        // Always check device screenReader status
        const isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
        setSettings(prevSettings => ({
          ...prevSettings,
          screenReaderEnabled: isScreenReaderEnabled
        }));
        
        setInitialized(true);
      } catch (error) {
        console.error('Error loading accessibility settings:', error);
        setInitialized(true);
      }
    };

    loadSettings();
    
    // Set up screen reader listener
    const screenReaderChangedListener = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      isScreenReaderEnabled => {
        setSettings(prevSettings => ({
          ...prevSettings,
          screenReaderEnabled: isScreenReaderEnabled
        }));
      }
    );

    return () => {
      if (screenReaderChangedListener?.remove) {
        screenReaderChangedListener.remove();
      } else if (typeof screenReaderChangedListener === 'function') {
        // Handle older React Native versions
        AccessibilityInfo.removeEventListener(
          'screenReaderChanged',
          screenReaderChangedListener
        );
      }
    };
  }, []);

  // Update theme when settings change
  useEffect(() => {
    if (initialized) {
      updateAccessibilitySettings(settings);
    }
  }, [settings, initialized, updateAccessibilitySettings]);

  // Function to update a specific setting
  const updateSetting = useCallback(async (key, value) => {
    if (!Object.keys(DEFAULT_SETTINGS).includes(key)) {
      console.error(`Invalid accessibility setting: ${key}`);
      return;
    }

    try {
      // Update state
      setSettings(prevSettings => ({
        ...prevSettings,
        [key]: value
      }));
      
      // Save to storage (except screenReaderEnabled which is device-controlled)
      if (key !== 'screenReaderEnabled') {
        const currentSettings = await AsyncStorage.getItem('accessibilitySettings');
        const parsedSettings = currentSettings ? JSON.parse(currentSettings) : {};
        
        const updatedSettings = {
          ...parsedSettings,
          [key]: value
        };
        
        await AsyncStorage.setItem('accessibilitySettings', JSON.stringify(updatedSettings));
      }
    } catch (error) {
      console.error(`Error updating accessibility setting ${key}:`, error);
    }
  }, []);

  // Reset all settings to defaults
  const resetSettings = useCallback(async () => {
    try {
      // Reset all settings except screenReaderEnabled (device-controlled)
      const { screenReaderEnabled } = settings;
      const resetValues = {
        ...DEFAULT_SETTINGS,
        screenReaderEnabled
      };
      
      // Update state
      setSettings(resetValues);
      
      // Save to storage
      await AsyncStorage.setItem('accessibilitySettings', JSON.stringify({
        largeText: false,
        boldText: false,
        highContrast: false,
        reducedMotion: false
      }));
      
      return true;
    } catch (error) {
      console.error('Error resetting accessibility settings:', error);
      return false;
    }
  }, [settings]);

  return {
    ...settings,
    updateSetting,
    resetSettings,
    initialized
  };
};

export default useAccessibility;
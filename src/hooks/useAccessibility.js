// src/hooks/useAccessibility.js
// Custom hook for accessibility features

import { useContext, createContext, useState, useEffect } from 'react';
import { AccessibilityInfo, Appearance, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create context
const AccessibilityContext = createContext(null);

// Default accessibility settings
const defaultSettings = {
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  screenReaderEnabled: false,
  boldText: false,
  grayscale: false,
};

// AccessibilityProvider component
export const AccessibilityProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);
  const colorScheme = useColorScheme();
  
  // Load saved settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await AsyncStorage.getItem('accessibilitySettings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        } else {
          // Check system settings
          checkSystemSettings();
        }
      } catch (error) {
        console.error('Error loading accessibility settings:', error);
      }
    };
    
    loadSettings();
  }, []);
  
  // Save settings to storage whenever they change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        await AsyncStorage.setItem('accessibilitySettings', JSON.stringify(settings));
      } catch (error) {
        console.error('Error saving accessibility settings:', error);
      }
    };
    
    saveSettings();
  }, [settings]);
  
  // Listen for system accessibility changes
  useEffect(() => {
    const screenReaderListener = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      isScreenReaderEnabled => {
        setSettings(prev => ({ ...prev, screenReaderEnabled: isScreenReaderEnabled }));
      }
    );
    
    const reduceMotionListener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      isReduceMotionEnabled => {
        setSettings(prev => ({ ...prev, reducedMotion: isReduceMotionEnabled }));
      }
    );
    
    // Check current status
    checkSystemSettings();
    
    return () => {
      // Clean up listeners
      screenReaderListener.remove();
      reduceMotionListener.remove();
    };
  }, []);
  
  // Check system accessibility settings
  const checkSystemSettings = async () => {
    try {
      const isScreenReaderEnabled = await AccessibilityInfo.isScreenReaderEnabled();
      const isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
      
      setSettings(prev => ({
        ...prev,
        screenReaderEnabled: isScreenReaderEnabled,
        reducedMotion: isReduceMotionEnabled,
      }));
      
      // On iOS we can check for more settings
      if (Platform.OS === 'ios') {
        const isBoldTextEnabled = await AccessibilityInfo.isBoldTextEnabled();
        const isGrayscaleEnabled = await AccessibilityInfo.isGrayscaleEnabled();
        
        setSettings(prev => ({
          ...prev,
          boldText: isBoldTextEnabled,
          grayscale: isGrayscaleEnabled,
        }));
      }
    } catch (error) {
      console.error('Error checking system accessibility settings:', error);
    }
  };
  
  // Update a specific setting
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  // Reset to default settings
  const resetSettings = () => {
    setSettings(defaultSettings);
  };
  
  // Get font size scaling factor based on settings
  const getFontScale = () => {
    if (settings.largeText) {
      return 1.3; // 30% larger text
    }
    return 1.0;
  };
  
  // Value provided to consumers
  const contextValue = {
    ...settings,
    updateSetting,
    resetSettings,
    fontScale: getFontScale(),
    isLightMode: colorScheme === 'light',
    isDarkMode: colorScheme === 'dark',
  };
  
  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
};

// Hook to use accessibility context
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

// src/components/AccessibilitySettingsScreen.js
// Screen for accessibility settings

import React from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Text, 
  Switch,
  TouchableOpacity,
  Platform
} from 'react-native';
import { useAccessibility } from '../hooks/useAccessibility';
import { useTheme } from '../theme/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

export const AccessibilitySettingsScreen = ({ navigation }) => {
  const { 
    reducedMotion, 
    highContrast, 
    largeText, 
    boldText,
    grayscale,
    updateSetting,
    resetSettings 
  } = useAccessibility();
  
  const { theme } = useTheme();
  
  const renderSetting = (title, description, value, onValueChange, icon) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIconContainer}>
        <Icon name={icon} size={24} color={theme.colors.primary.main} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ 
          false: theme.colors.gray[300], 
          true: theme.colors.primary.main 
        }}
        thumbColor={Platform.OS === 'ios' 
          ? null 
          : value 
            ? theme.colors.primary.light 
            : theme.colors.gray[100]
        }
      />
    </View>
  );
  
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Accessibility Settings</Text>
          <Text style={styles.headerSubtitle}>
            Customize your app experience for better accessibility
          </Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visibility</Text>
          
          {renderSetting(
            'Larger Text',
            'Increase text size throughout the app',
            largeText,
            (value) => updateSetting('largeText', value),
            'text-outline'
          )}
          
          {renderSetting(
            'High Contrast',
            'Enhance color contrast for better visibility',
            highContrast,
            (value) => updateSetting('highContrast', value),
            'contrast-outline'
          )}
          
          {Platform.OS === 'ios' && renderSetting(
            'Bold Text',
            'Make text bolder for better readability',
            boldText,
            (value) => updateSetting('boldText', value),
            'create-outline'
          )}
          
          {Platform.OS === 'ios' && renderSetting(
            'Grayscale',
            'Display content in grayscale colors',
            grayscale,
            (value) => updateSetting('grayscale', value),
            'contrast-outline'
          )}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Motion</Text>
          
          {renderSetting(
            'Reduced Motion',
            'Minimize animations and motion effects',
            reducedMotion,
            (value) => updateSetting('reducedMotion', value),
            'scan-outline'
          )}
        </View>
        
        <View style={styles.resetContainer}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              resetSettings();
            }}
          >
            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#546E7A',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  settingIconContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#263238',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#78909C',
  },
  resetContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resetButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#ECEFF1',
  },
  resetButtonText: {
    fontSize: 16,
    color: '#546E7A',
    fontWeight: '500',
  },
});

// src/components/AccessibleText.js
// Accessible text component that respects user settings

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useAccessibility } from '../hooks/useAccessibility';

/**
 * AccessibleText component that respects accessibility settings
 */
export const AccessibleText = ({
  children,
  style,
  variant = 'body1',
  ...props
}) => {
  const { fontScale, largeText, boldText, highContrast } = useAccessibility();
  
  // Get base style from variant
  const getBaseStyle = () => {
    switch (variant) {
      case 'h1':
        return styles.h1;
      case 'h2':
        return styles.h2;
      case 'h3':
        return styles.h3;
      case 'h4':
        return styles.h4;
      case 'body1':
        return styles.body1;
      case 'body2':
        return styles.body2;
      case 'caption':
        return styles.caption;
      default:
        return styles.body1;
    }
  };
  
  // Apply accessibility modifications
  const getAccessibilityStyle = () => {
    const accessibilityStyles = [];
    
    // Apply font scaling
    if (largeText) {
      accessibilityStyles.push({
        fontSize: getBaseStyle().fontSize * fontScale,
      });
    }
    
    // Apply bold text if needed
    if (boldText && variant !== 'h1' && variant !== 'h2' && variant !== 'h3') {
      accessibilityStyles.push({
        fontWeight: 'bold',
      });
    }
    
    // Apply high contrast if needed
    if (highContrast) {
      accessibilityStyles.push({
        color: '#000000',
      });
    }
    
    return accessibilityStyles;
  };
  
  return (
    <Text
      style={[getBaseStyle(), ...getAccessibilityStyle(), style]}
      {...props}
    >
      {children}
    </Text>
  );
};

// Base text styles
const styles = StyleSheet.create({
  h1: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 8,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 8,
  },
  h3: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 6,
  },
  h4: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 4,
  },
  body1: {
    fontSize: 16,
    color: '#455A64',
    lineHeight: 24,
  },
  body2: {
    fontSize: 14,
    color: '#546E7A',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    color: '#78909C',
  },
});

// src/components/AccessibleTouchable.js
// Accessible touchable component

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useAccessibility } from '../hooks/useAccessibility';

/**
 * AccessibleTouchable component that respects accessibility settings
 */
export const AccessibleTouchable = ({
  children,
  style,
  disableAnimation = false,
  activeOpacity = 0.7,
  ...props
}) => {
  const { reducedMotion } = useAccessibility();
  
  // Determine appropriate active opacity based on settings
  const getActiveOpacity = () => {
    if (disableAnimation || reducedMotion) {
      return 0.9; // Less animation when reduced motion is enabled
    }
    return activeOpacity;
  };
  
  return (
    <TouchableOpacity
      style={style}
      activeOpacity={getActiveOpacity()}
      accessible={true}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
};

// src/components/AccessibleImage.js
// Accessible image component

import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useAccessibility } from '../hooks/useAccessibility';

/**
 * AccessibleImage component that respects accessibility settings
 */
export const AccessibleImage = ({
  source,
  style,
  contentDescription,
  useFastImage = true,
  resizeMode = 'cover',
  showBorder = false,
  ...props
}) => {
  const { highContrast, grayscale } = useAccessibility();
  
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
    if (grayscale) {
      return {
        filter: [{ saturate: 0 }], // Grayscale filter
      };
    }
    return {};
  };
  
  // FastImage supports accessibility props directly
  if (useFastImage) {
    return (
      <View style={[styles.wrapper, ...getWrapperStyle(), style]}>
        <FastImage
          source={source}
          style={[styles.image, getFilterStyle()]}
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
          accessible={true}
          accessibilityLabel={contentDescription}
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
        style={[styles.image, getFilterStyle()]}
        resizeMode={resizeMode}
        accessible={true}
        accessibilityLabel={contentDescription}
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
    borderWidth: 1,
    borderColor: '#000000',
  },
});

// src/components/ScreenReaderAnnouncement.js
// Utility component for screen reader announcements

import React, { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Component to make screen reader announcements
 */
export const ScreenReaderAnnouncement = ({ message }) => {
  useEffect(() => {
    if (message) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
  
  // This component doesn't render anything
  return null;
};

/**
 * Function to announce messages to screen reader
 * 
 * @param {string} message - Message to announce
 */
export const announceToScreenReader = (message) => {
  if (message) {
    AccessibilityInfo.announceForAccessibility(message);
  }
};

// src/utils/accessibilityUtils.js
// Utility functions for accessibility

import { Platform } from 'react-native';

/**
 * Generate accessibility props for elements
 * 
 * @param {Object} options - Accessibility options
 * @returns {Object} Accessibility props
 */
export const getAccessibilityProps = ({
  label,
  hint,
  role,
  state = {},
  testID,
}) => {
  if (Platform.OS === 'ios') {
    return {
      accessible: true,
      accessibilityLabel: label,
      accessibilityHint: hint,
      accessibilityRole: role,
      accessibilityState: state,
      testID: testID || label,
    };
  }
  
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: role,
    accessibilityState: state,
    testID: testID || label,
  };
};

/**
 * Accessibility roles mapping
 * Consistent naming for React Native accessibility roles
 */
export const AccessibilityRoles = {
  BUTTON: 'button',
  IMAGE: 'image',
  LINK: 'link',
  HEADER: 'header',
  SEARCH: 'search',
  SUMMARY: 'summary',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  TAB: 'tab',
  MENU_ITEM: 'menuitem',
  SWITCH: 'switch',
  NONE: 'none',
};

/**
 * Creates accessibility state object
 * 
 * @param {Object} options - State options
 * @returns {Object} Accessibility state object
 */
export const createAccessibilityState = ({
  disabled = false,
  selected = false,
  checked = undefined,
  busy = false,
  expanded = undefined,
}) => {
  return {
    disabled,
    selected,
    checked,
    busy,
    expanded,
  };
};
// src/contexts/LanguageContext.js
// Enhanced Language Context with proper RTL support and robust error handling

import React, { createContext, useState, useEffect, useContext } from 'react';
import { I18nManager, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import Config from 'react-native-config';
import { AnalyticsService } from '../services/AnalyticsService';

// Create the Language context
const LanguageContext = createContext();

// Parse supported languages from environment
const SUPPORTED_LANGUAGES = (Config.SUPPORTED_LANGUAGES || 'en').split(',').map(lang => lang.trim());
const DEFAULT_LANGUAGE = Config.DEFAULT_LANGUAGE || 'en';
const ENABLE_LANGUAGE_DETECTION = Config.ENABLE_LANGUAGE_DETECTION === 'true';

// Provider component
export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [isRTL, setIsRTL] = useState(I18nManager.isRTL);
  const [initialized, setInitialized] = useState(false);

  // Get available languages with their native names
  const availableLanguages = [
    { code: 'en', name: 'English', nativeName: 'English', isRTL: false },
    { code: 'es', name: 'Spanish', nativeName: 'Español', isRTL: false },
    { code: 'fr', name: 'French', nativeName: 'Français', isRTL: false },
    { code: 'de', name: 'German', nativeName: 'Deutsch', isRTL: false },
    { code: 'zh', name: 'Chinese', nativeName: '中文', isRTL: false },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', isRTL: false },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', isRTL: true },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', isRTL: true },
  ].filter(lang => SUPPORTED_LANGUAGES.includes(lang.code));

  // Initialize language settings
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        // Try to get the stored language setting
        const storedLanguage = await AsyncStorage.getItem('userLanguage');
        
        let selectedLanguage = DEFAULT_LANGUAGE;
        
        if (storedLanguage && SUPPORTED_LANGUAGES.includes(storedLanguage)) {
          // Use stored language if available and supported
          selectedLanguage = storedLanguage;
        } else if (ENABLE_LANGUAGE_DETECTION) {
          // Detect device language if enabled
          const deviceLanguages = RNLocalize.getLocales();
          
          // Find the first supported language from device preferences
          for (const locale of deviceLanguages) {
            const languageCode = locale.languageCode;
            if (SUPPORTED_LANGUAGES.includes(languageCode)) {
              selectedLanguage = languageCode;
              break;
            }
          }
        }
        
        // Apply the selected language
        await changeLanguage(selectedLanguage, false);
        
        setInitialized(true);
        
        // Log language initialization
        AnalyticsService.logEvent('language_initialized', {
          language: selectedLanguage,
          detected: ENABLE_LANGUAGE_DETECTION && !storedLanguage,
          deviceLocale: RNLocalize.getLocales()[0]?.languageCode || 'unknown'
        });
      } catch (error) {
        console.error('Error initializing language:', error);
        
        // Fall back to default language in case of error
        await changeLanguage(DEFAULT_LANGUAGE, false);
        setInitialized(true);
        
        // Log error
        AnalyticsService.logError(error, { context: 'language_initialization' });
      }
    };

    initializeLanguage();
    
    // Listen for device locale changes
    const localeChangeListener = RNLocalize.addEventListener('change', () => {
      if (ENABLE_LANGUAGE_DETECTION) {
        // Only automatically change language if we're using auto-detection
        // and the user hasn't explicitly chosen a language
        AsyncStorage.getItem('userLanguage').then(storedLanguage => {
          if (!storedLanguage) {
            initializeLanguage();
          }
        });
      }
    });

    return () => {
      // Clean up the locale change listener
      localeChangeListener.remove();
    };
  }, []);
  
  // Function to change the language
  const changeLanguage = async (languageCode, persistSelection = true) => {
    try {
      if (!SUPPORTED_LANGUAGES.includes(languageCode)) {
        throw new Error(`Language not supported: ${languageCode}`);
      }
      
      // Get language info
      const langInfo = availableLanguages.find(lang => lang.code === languageCode);
      
      if (!langInfo) {
        throw new Error(`Language info not found: ${languageCode}`);
      }
      
      // Change language in i18n
      await i18n.changeLanguage(languageCode);
      
      // Update state
      setLanguage(languageCode);
      
      // Handle RTL
      const isRTLLanguage = langInfo.isRTL;
      
      // Only force restart if RTL setting changed and platform is Android
      const needsRestart = isRTLLanguage !== I18nManager.isRTL && Platform.OS === 'android';
      
      // Update RTL setting if needed
      if (isRTLLanguage !== I18nManager.isRTL) {
        setIsRTL(isRTLLanguage);
        I18nManager.forceRTL(isRTLLanguage);
      }
      
      // Persist user selection if requested
      if (persistSelection) {
        await AsyncStorage.setItem('userLanguage', languageCode);
        
        // Log language change
        AnalyticsService.logEvent('language_changed', {
          language: languageCode,
          rtl: isRTLLanguage,
          needsRestart
        });
      }
      
      // Alert user about restart if necessary
      if (needsRestart) {
        Alert.alert(
          i18n.t('language_restart_title', 'Restart Required'),
          i18n.t('language_restart_message', 'The app needs to restart to apply the language change.'),
          [
            {
              text: i18n.t('restart_now', 'Restart Now'),
              onPress: () => {
                // In a real app, you would use a native module to restart
                // For example with react-native-restart
                console.log('App would restart here');
              }
            }
          ]
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error changing language:', error);
      AnalyticsService.logError(error, { 
        context: 'language_change',
        targetLanguage: languageCode
      });
      return false;
    }
  };
  
  // Get language name from code
  const getLanguageName = (code, native = false) => {
    const lang = availableLanguages.find(lang => lang.code === code);
    if (!lang) return code;
    return native ? lang.nativeName : lang.name;
  };
  
  // Format date according to current locale
  const formatDate = (date, options = {}) => {
    try {
      if (!date) return '';
      
      // Create a Date object if string is provided
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Default options
      const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
      };
      
      return dateObj.toLocaleDateString(language, defaultOptions);
    } catch (error) {
      console.error('Error formatting date:', error);
      return date.toString();
    }
  };
  
  // Format time according to current locale
  const formatTime = (date, options = {}) => {
    try {
      if (!date) return '';
      
      // Create a Date object if string is provided
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Default options
      const defaultOptions = {
        hour: 'numeric',
        minute: 'numeric',
        ...options
      };
      
      return dateObj.toLocaleTimeString(language, defaultOptions);
    } catch (error) {
      console.error('Error formatting time:', error);
      return date.toString();
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        isRTL,
        availableLanguages,
        changeLanguage,
        getLanguageName,
        formatDate,
        formatTime,
        initialized,
        t: i18n.t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook to use the language context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

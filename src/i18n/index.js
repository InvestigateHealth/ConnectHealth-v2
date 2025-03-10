// src/i18n/index.js
// Internationalization configuration for HealthConnect

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'react-native-localize';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translations
import en from './translations/en';
import es from './translations/es';
import fr from './translations/fr';
import de from './translations/de';
import zh from './translations/zh';
import ja from './translations/ja';
import ar from './translations/ar';

// Translation resources
const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  zh: { translation: zh },
  ja: { translation: ja },
  ar: { translation: ar },
};

// Language detection options
const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      // Try to get stored language from AsyncStorage
      const storedLanguage = await AsyncStorage.getItem('@language');
      
      if (storedLanguage) {
        return callback(storedLanguage);
      }
      
      // If no stored language, use device settings
      const deviceLocales = getLocales();
      const deviceLanguage = deviceLocales[0]?.languageCode || 'en';
      
      // Check if device language is supported
      if (Object.keys(resources).includes(deviceLanguage)) {
        // Store detected language for future use
        await AsyncStorage.setItem('@language', deviceLanguage);
        return callback(deviceLanguage);
      } else {
        // Default to English if language not supported
        await AsyncStorage.setItem('@language', 'en');
        return callback('en');
      }
    } catch (error) {
      console.error('Error detecting language:', error);
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem('@language', language);
    } catch (error) {
      console.error('Error caching language:', error);
    }
  }
};

// Initialize i18n
i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    compatibilityJSON: 'v3', // Required for Android
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Prevents issues with Suspense
    },
  });

export default i18n;

// Helper function to change language
export const changeLanguage = async (language) => {
  try {
    await i18n.changeLanguage(language);
    await AsyncStorage.setItem('@language', language);
    return true;
  } catch (error) {
    console.error('Error changing language:', error);
    return false;
  }
};

// Helper to get available languages
export const getAvailableLanguages = () => {
  return [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ar', name: 'العربية' }
  ];
};

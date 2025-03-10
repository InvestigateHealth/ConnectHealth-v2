// src/contexts/LanguageContext.js
// Context for managing language throughout the app

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { getAvailableLanguages } from '../i18n';

// Create context
const LanguageContext = createContext();

// Language provider component
export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [isRTL, setIsRTL] = useState(I18nManager.isRTL);

  // Initialize available languages
  useEffect(() => {
    setAvailableLanguages(getAvailableLanguages());
  }, []);

  // Update current language when i18n language changes
  useEffect(() => {
    setCurrentLanguage(i18n.language);
    // Check if the language is RTL
    const rtlLanguages = ['ar', 'he', 'ur', 'fa'];
    setIsRTL(rtlLanguages.includes(i18n.language));
  }, [i18n.language]);

  // Function to change language
  const changeLanguage = async (languageCode) => {
    try {
      await i18n.changeLanguage(languageCode);
      await AsyncStorage.setItem('@language', languageCode);
      
      // Handle RTL languages
      const rtlLanguages = ['ar', 'he', 'ur', 'fa'];
      const shouldBeRTL = rtlLanguages.includes(languageCode);
      
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.forceRTL(shouldBeRTL);
        // In a real app, you might want to reload the app here
        // or notify the user that a restart is required
      }
      
      setCurrentLanguage(languageCode);
      setIsRTL(shouldBeRTL);
      return true;
    } catch (error) {
      console.error('Error changing language:', error);
      return false;
    }
  };

  // Get language name from code
  const getLanguageName = (code) => {
    const language = availableLanguages.find(lang => lang.code === code);
    return language ? language.name : code;
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        isRTL,
        availableLanguages,
        changeLanguage,
        getLanguageName,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook for using the language context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

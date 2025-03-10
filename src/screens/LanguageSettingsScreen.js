// src/screens/LanguageSettingsScreen.js
// Language settings screen for HealthConnect

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getAvailableLanguages, changeLanguage } from '../i18n';
import { AnalyticsService } from '../services/AnalyticsService';

const LanguageSettingsScreen = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [languages, setLanguages] = useState([]);
  const [currentLanguage, setCurrentLanguage] = useState('');
  const [loading, setLoading] = useState(false);

  // Get available languages and current language on component mount
  useEffect(() => {
    const availableLanguages = getAvailableLanguages();
    setLanguages(availableLanguages);
    setCurrentLanguage(i18n.language);
  }, [i18n.language]);

  // Handle language selection
  const handleSelectLanguage = async (languageCode) => {
    if (languageCode === currentLanguage) return;
    
    setLoading(true);
    try {
      const success = await changeLanguage(languageCode);
      if (success) {
        setCurrentLanguage(languageCode);
        
        // Log language change analytics
        AnalyticsService.logEvent('language_changed', {
          previous_language: currentLanguage,
          new_language: languageCode
        });
        
        // Show success message
        Alert.alert(
          t('success'),
          t('language_changed'),
          [{ text: t('ok') }]
        );
      }
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert(
        t('error'),
        t('unknown_error'),
        [{ text: t('ok') }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Render language item
  const renderLanguageItem = ({ item }) => {
    const isSelected = item.code === currentLanguage;
    
    return (
      <TouchableOpacity
        style={[
          styles.languageItem,
          { backgroundColor: theme.colors.background.paper }
        ]}
        onPress={() => handleSelectLanguage(item.code)}
        disabled={loading}
      >
        <Text style={[
          styles.languageName,
          { color: theme.colors.text.primary }
        ]}>
          {item.name}
        </Text>
        
        {isSelected && (
          <Icon 
            name="check" 
            size={24} 
            color={theme.colors.primary.main} 
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: theme.colors.background.default }
    ]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon 
            name="arrow-left" 
            size={24} 
            color={theme.colors.text.primary} 
          />
        </TouchableOpacity>
        <Text style={[
          styles.headerTitle,
          { color: theme.colors.text.primary }
        ]}>
          {t('language_settings')}
        </Text>
      </View>
      
      <View style={styles.content}>
        <Text style={[
          styles.description,
          { color: theme.colors.text.secondary }
        ]}>
          {t('select_language')}
        </Text>
        
        {loading ? (
          <ActivityIndicator 
            size="large" 
            color={theme.colors.primary.main} 
            style={styles.loader} 
          />
        ) : (
          <FlatList
            data={languages}
            renderItem={renderLanguageItem}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => (
              <View 
                style={[
                  styles.separator,
                  { backgroundColor: theme.colors.divider }
                ]} 
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    fontSize: 16,
    marginBottom: 16,
  },
  list: {
    flexGrow: 1,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  languageName: {
    fontSize: 16,
  },
  separator: {
    height: 1,
    marginVertical: 8,
  },
  loader: {
    marginTop: 32,
  },
});

export default LanguageSettingsScreen;

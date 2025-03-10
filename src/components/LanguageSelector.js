// src/components/LanguageSelector.js
// Reusable language selector component

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  SafeAreaView
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../theme/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const LanguageSelector = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { availableLanguages, currentLanguage, changeLanguage } = useLanguage();

  // Handle language selection
  const handleSelectLanguage = async (languageCode) => {
    await changeLanguage(languageCode);
    onClose();
  };

  // Render language item
  const renderLanguageItem = ({ item }) => {
    const isSelected = item.code === currentLanguage;
    
    return (
      <TouchableOpacity
        style={[
          styles.languageItem,
          { backgroundColor: isSelected ? theme.colors.primary.light : theme.colors.background.paper }
        ]}
        onPress={() => handleSelectLanguage(item.code)}
      >
        <Text style={[
          styles.languageName,
          { 
            color: isSelected ? theme.colors.primary.contrastText : theme.colors.text.primary,
            fontWeight: isSelected ? 'bold' : 'normal'
          }
        ]}>
          {item.name}
        </Text>
        
        {isSelected && (
          <Icon 
            name="check" 
            size={20} 
            color={theme.colors.primary.contrastText} 
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={[
          styles.modalContent,
          { backgroundColor: theme.colors.background.default }
        ]}>
          <View style={styles.header}>
            <Text style={[
              styles.title,
              { color: theme.colors.text.primary }
            ]}>
              {t('select_language')}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Icon 
                name="close" 
                size={24} 
                color={theme.colors.text.primary} 
              />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={availableLanguages}
            renderItem={renderLanguageItem}
            keyExtractor={(item) => item.code}
            ItemSeparatorComponent={() => (
              <View 
                style={[
                  styles.separator,
                  { backgroundColor: theme.colors.divider }
                ]} 
              />
            )}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginVertical: 4,
  },
  languageName: {
    fontSize: 16,
  },
  separator: {
    height: 1,
  },
});

export default LanguageSelector;

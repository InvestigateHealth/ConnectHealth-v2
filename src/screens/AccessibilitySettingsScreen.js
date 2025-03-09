// src/screens/AccessibilitySettingsScreen.js
// Screen for configuring accessibility settings

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccessibility } from '../hooks/useAccessibility';

const AccessibilitySettingsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { 
    reducedMotion, 
    highContrast,
    largeText,
    boldText,
    screenReaderEnabled,
    updateSetting,
    resetSettings
  } = useAccessibility();
  
  const [isResetting, setIsResetting] = useState(false);

  // Handle resetting settings to defaults
  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all accessibility settings to their defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            setIsResetting(true);
            await resetSettings();
            setIsResetting(false);
          }
        }
      ]
    );
  };

  // Render a setting item with a switch
  const renderSetting = (
    title, 
    description, 
    value, 
    onValueChange, 
    iconName, 
    disabled = false
  ) => (
    <View style={[
      styles.settingItem,
      { borderBottomColor: theme.colors.divider }
    ]}>
      <View style={styles.settingIconContainer}>
        <Icon 
          name={iconName} 
          size={24} 
          color={disabled ? theme.colors.text.disabled : theme.colors.primary.main} 
        />
      </View>
      
      <View style={styles.settingContent}>
        <Text style={[
          styles.settingTitle,
          { color: disabled ? theme.colors.text.disabled : theme.colors.text.primary }
        ]}>
          {title}
        </Text>
        
        <Text style={[
          styles.settingDescription,
          { color: disabled ? theme.colors.text.disabled : theme.colors.text.secondary }
        ]}>
          {description}
        </Text>
      </View>
      
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
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
    <View style={[
      styles.container,
      { backgroundColor: theme.colors.background.default }
    ]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[
            styles.headerTitle,
            { color: theme.colors.text.primary }
          ]}>
            Accessibility Settings
          </Text>
          
          <Text style={[
            styles.headerSubtitle,
            { color: theme.colors.text.secondary }
          ]}>
            Customize your app experience for better accessibility
          </Text>
        </View>
        
        <View style={[
          styles.section,
          { 
            backgroundColor: theme.colors.background.card,
            ...theme.shadows.sm
          }
        ]}>
          <Text style={[
            styles.sectionTitle,
            { color: theme.colors.text.primary }
          ]}>
            Display
          </Text>
          
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
          
          {renderSetting(
            'Bold Text',
            'Make text bolder for better readability',
            boldText,
            (value) => updateSetting('boldText', value),
            'create-outline',
            Platform.OS !== 'ios' // Only enable on iOS
          )}
        </View>
        
        <View style={[
          styles.section,
          { 
            backgroundColor: theme.colors.background.card,
            ...theme.shadows.sm
          }
        ]}>
          <Text style={[
            styles.sectionTitle,
            { color: theme.colors.text.primary }
          ]}>
            Motion
          </Text>
          
          {renderSetting(
            'Reduced Motion',
            'Minimize animations and motion effects',
            reducedMotion,
            (value) => updateSetting('reducedMotion', value),
            'scan-outline'
          )}
        </View>
        
        <View style={[
          styles.section,
          { 
            backgroundColor: theme.colors.background.card,
            ...theme.shadows.sm
          }
        ]}>
          <Text style={[
            styles.sectionTitle,
            { color: theme.colors.text.primary }
          ]}>
            Screen Reader
          </Text>
          
          <View style={styles.screenReaderInfo}>
            <Icon 
              name="information-circle-outline" 
              size={24} 
              color={theme.colors.info.main} 
            />
            <Text style={[
              styles.screenReaderText,
              { color: theme.colors.text.secondary }
            ]}>
              Screen Reader is {screenReaderEnabled ? 'enabled' : 'disabled'} on your device.
              {'\n\n'}
              You can change this in your device's accessibility settings.
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[
            styles.resetButton,
            { backgroundColor: theme.colors.error.light }
          ]}
          onPress={handleResetSettings}
          disabled={isResetting}
        >
          <Icon name="refresh-outline" size={20} color={theme.colors.error.main} />
          <Text style={[
            styles.resetButtonText,
            { color: theme.colors.error.main }
          ]}>
            {isResetting ? 'Resetting...' : 'Reset to Default Settings'}
          </Text>
        </TouchableOpacity>
        
        <Text style={[
          styles.infoText,
          { color: theme.colors.text.hint }
        ]}>
          These settings affect how HealthConnect looks and behaves on your device.
          Some settings may require restarting the app to take full effect.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  section: {
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  settingIconContainer: {
    width: 40,
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  screenReaderInfo: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'flex-start',
  },
  screenReaderText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 16,
    lineHeight: 20,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
});

export default AccessibilitySettingsScreen;

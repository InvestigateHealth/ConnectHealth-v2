// src/utils/haptics.js
// Utility functions for haptic feedback with cross-platform support

import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration for haptic feedback
const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Store user preference for haptic feedback
let hapticsEnabled = true;

// Initialize haptics preference from storage
const initHaptics = async () => {
  try {
    const value = await AsyncStorage.getItem('@haptics_enabled');
    if (value !== null) {
      hapticsEnabled = value === 'true';
    }
  } catch (error) {
    console.error('Error loading haptics preference:', error);
  }
};

// Call init when the module is imported
initHaptics();

/**
 * Set whether haptic feedback is enabled
 * @param {boolean} enabled - Whether haptic feedback should be enabled
 */
export const setHapticsEnabled = async (enabled) => {
  try {
    hapticsEnabled = enabled;
    await AsyncStorage.setItem('@haptics_enabled', String(enabled));
  } catch (error) {
    console.error('Error saving haptics preference:', error);
  }
};

/**
 * Check if haptic feedback is enabled
 * @returns {boolean} Whether haptic feedback is enabled
 */
export const isHapticsEnabled = () => hapticsEnabled;

/**
 * Trigger a selection feedback for small UI interactions
 */
export const selectionLight = () => {
  if (!hapticsEnabled) return;
  
  try {
    ReactNativeHapticFeedback.trigger(
      Platform.OS === 'ios' ? 'selection' : 'keyboardTap',
      options
    );
  } catch (error) {
    console.error('Haptic feedback error:', error);
  }
};

/**
 * Trigger a light impact feedback for UI interactions
 */
export const impactLight = () => {
  if (!hapticsEnabled) return;
  
  try {
    ReactNativeHapticFeedback.trigger(
      Platform.OS === 'ios' ? 'impactLight' : 'contextClick',
      options
    );
  } catch (error) {
    console.error('Haptic feedback error:', error);
  }
};

/**
 * Trigger a medium impact feedback for more significant UI interactions
 */
export const impactMedium = () => {
  if (!hapticsEnabled) return;
  
  try {
    ReactNativeHapticFeedback.trigger(
      Platform.OS === 'ios' ? 'impactMedium' : 'clockTick',
      options
    );
  } catch (error) {
    console.error('Haptic feedback error:', error);
  }
};

/**
 * Trigger a heavy impact feedback for major interactions
 */
export const impactHeavy = () => {
  if (!hapticsEnabled) return;
  
  try {
    ReactNativeHapticFeedback.trigger(
      Platform.OS === 'ios' ? 'impactHeavy' : 'effectHeavyClick',
      options
    );
  } catch (error) {
    console.error('Haptic feedback error:', error);
  }
};

/**
 * Trigger a success feedback
 */
export const notificationSuccess = () => {
  if (!hapticsEnabled) return;
  
  try {
    ReactNativeHapticFeedback.trigger(
      Platform.OS === 'ios' ? 'notificationSuccess' : 'effectClick',
      options
    );
  } catch (error) {
    console.error('Haptic feedback error:', error);
  }
};

/**
 * Trigger a warning feedback
 */
export const notificationWarning = () => {
  if (!hapticsEnabled) return;
  
  try {
    ReactNativeHapticFeedback.trigger(
      Platform.OS === 'ios' ? 'notificationWarning' : 'effectDoubleClick',
      options
    );
  } catch (error) {
    console.error('Haptic feedback error:', error);
  }
};

/**
 * Trigger an error feedback
 */
export const notificationError = () => {
  if (!hapticsEnabled) return;
  
  try {
    ReactNativeHapticFeedback.trigger(
      Platform.OS === 'ios' ? 'notificationError' : 'effectHeavyClick',
      options
    );
  } catch (error) {
    console.error('Haptic feedback error:', error);
  }
};

export default {
  selectionLight,
  impactLight,
  impactMedium,
  impactHeavy,
  notificationSuccess,
  notificationWarning,
  notificationError,
  setHapticsEnabled,
  isHapticsEnabled,
};

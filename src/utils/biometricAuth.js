// src/utils/biometricAuth.js
// Biometric authentication utilities (Touch ID, Face ID, Fingerprint)

import ReactNativeBiometrics from 'react-native-biometrics';
import * as Keychain from 'react-native-keychain';
import { Platform, Alert } from 'react-native';
import { AnalyticsService } from '../services/AnalyticsService';

// Initialize the biometrics library
const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true, // Allow PIN/pattern as fallback on Android
});

/**
 * Check if biometric authentication is available
 * @returns {Promise<Object>} Result object with available and biometryType
 */
export const isBiometricAvailable = async () => {
  try {
    const { available, biometryType } = await rnBiometrics.isSensorAvailable();
    
    // Log for analytics
    AnalyticsService.logEvent('biometric_check', {
      available,
      biometryType: biometryType || 'none'
    });
    
    return {
      available,
      biometryType
    };
  } catch (error) {
    console.error('Error checking biometric availability:', error);
    AnalyticsService.logError(error, { context: 'biometric_check' });
    
    return {
      available: false,
      biometryType: null,
      error: error.message
    };
  }
};

/**
 * Get friendly name for biometry type
 * @param {string} biometryType - Type returned from isSensorAvailable
 * @returns {string} User-friendly name
 */
export const getBiometryTypeName = (biometryType) => {
  switch (biometryType) {
    case 'FaceID':
      return 'Face ID';
    case 'TouchID':
      return 'Touch ID';
    case 'Fingerprint':
      return 'Fingerprint';
    default:
      return 'Biometric Authentication';
  }
};

/**
 * Prompt user to enable biometric authentication
 * @returns {Promise<boolean>} Whether biometrics were enabled
 */
export const enableBiometricLogin = async () => {
  try {
    // Check if biometrics are available
    const { available, biometryType } = await isBiometricAvailable();
    
    if (!available) {
      // Show error message if biometrics are not available
      Alert.alert(
        'Biometric Authentication Not Available',
        'Your device does not support biometric authentication.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    // Generate keys for secure authentication
    const { publicKey } = await rnBiometrics.createKeys();
    
    if (publicKey) {
      // Store the public key for later verification
      await AsyncStorage.setItem('biometricPublicKey', publicKey);
      
      // Mark that biometric login is enabled
      await AsyncStorage.setItem('biometricLoginEnabled', 'true');
      
      // Log success
      AnalyticsService.logEvent('biometric_enabled', {
        biometryType,
        success: true
      });
      
      return true;
    } else {
      throw new Error('Failed to generate biometric keys');
    }
  } catch (error) {
    console.error('Error enabling biometric login:', error);
    AnalyticsService.logError(error, { context: 'enable_biometric_login' });
    
    // Show error message
    Alert.alert(
      'Setup Failed',
      'Failed to set up biometric authentication. Please try again later.',
      [{ text: 'OK' }]
    );
    
    return false;
  }
};

/**
 * Authenticate user using biometrics
 * @param {Object} options - Authentication options
 * @returns {Promise<Object>} Authentication result
 */
export const authenticateWithBiometrics = async (options = {}) => {
  try {
    const {
      promptMessage = 'Confirm your identity',
      cancelButtonText = 'Cancel'
    } = options;
    
    // Check if biometrics are available
    const { available, biometryType } = await isBiometricAvailable();
    
    if (!available) {
      throw new Error('Biometric authentication not available');
    }
    
    // Get the saved public key
    const publicKey = await AsyncStorage.getItem('biometricPublicKey');
    
    if (!publicKey) {
      throw new Error('Biometric keys not found. Please set up biometric login again.');
    }
    
    // Create a payload to sign
    const epochTimeSeconds = Math.round((new Date()).getTime() / 1000).toString();
    const payload = `${epochTimeSeconds}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Prompt user for biometric authentication
    const { success, signature } = await rnBiometrics.createSignature({
      promptMessage,
      payload,
      cancelButtonText
    });
    
    if (success && signature) {
      // In a real app, you would verify this signature on the server
      // For now, we'll just consider it successful
      
      // Log success
      AnalyticsService.logEvent('biometric_authentication', {
        biometryType,
        success: true
      });
      
      return {
        success: true,
        biometryType
      };
    } else {
      throw new Error('Biometric authentication failed');
    }
  } catch (error) {
    console.error('Error authenticating with biometrics:', error);
    AnalyticsService.logError(error, { context: 'authenticate_with_biometrics' });
    
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Disable biometric login
 * @returns {Promise<boolean>} Whether disabling was successful
 */
export const disableBiometricLogin = async () => {
  try {
    // Remove biometric keys
    await rnBiometrics.deleteKeys();
    
    // Remove stored settings
    await AsyncStorage.removeItem('biometricPublicKey');
    await AsyncStorage.removeItem('biometricLoginEnabled');
    
    // Log success
    AnalyticsService.logEvent('biometric_disabled', {
      success: true
    });
    
    return true;
  } catch (error) {
    console.error('Error disabling biometric login:', error);
    AnalyticsService.logError(error, { context: 'disable_biometric_login' });
    
    return false;
  }
};

/**
 * Check if biometric login is enabled
 * @returns {Promise<boolean>} Whether biometric login is enabled
 */
export const isBiometricLoginEnabled = async () => {
  try {
    const enabled = await AsyncStorage.getItem('biometricLoginEnabled');
    return enabled === 'true';
  } catch (error) {
    console.error('Error checking if biometric login is enabled:', error);
    return false;
  }
};

export default {
  isBiometricAvailable,
  getBiometryTypeName,
  enableBiometricLogin,
  authenticateWithBiometrics,
  disableBiometricLogin,
  isBiometricLoginEnabled
};
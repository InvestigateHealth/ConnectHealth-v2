// src/screens/LoginScreen.js
// Internationalized login screen

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next'; // Import useTranslation hook
import { useTheme } from '../theme/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext'; // Import language context
import { AnalyticsService } from '../services/AnalyticsService';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DISPOSABLE_EMAIL_DOMAINS } from '../constants/disposableEmailDomains';

const LoginScreen = () => {
  // Use i18n for translations
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { isRTL } = useLanguage(); // Get RTL status
  
  // State for form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validate email
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
      setEmailError(t('invalid_email'));
      return false;
    }
    
    if (!emailRegex.test(email)) {
      setEmailError(t('invalid_email'));
      return false;
    }
    
    // Check for disposable email domains
    const domain = email.split('@')[1];
    if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
      setEmailError(t('disposable_email'));
      return false;
    }
    
    setEmailError('');
    return true;
  };

  // Validate password
  const validatePassword = (password) => {
    if (!password || password.length < 8) {
      setPasswordError(t('invalid_password'));
      return false;
    }
    setPasswordError('');
    return true;
  };

  // Handle login
  const handleLogin = async () => {
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    
    if (!isEmailValid || !isPasswordValid) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Login with Firebase auth
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      
      // Store last logged in email
      await AsyncStorage.setItem('@last_email', email);
      
      // Log successful login
      AnalyticsService.logEvent('user_login', {
        method: 'email',
        success: true
      });
      
      // Navigation will be handled by onAuthStateChanged in App.js
      
    } catch (error) {
      console.error('Login failed:', error);
      
      // Log failed login attempt
      AnalyticsService.logEvent('user_login', {
        method: 'email',
        success: false,
        error: error.code
      });
      
      // Show appropriate error message
      let errorMessage = t('login_failed');
      
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = t('login_failed');
          break;
        case 'auth/too-many-requests':
          errorMessage = t('too_many_attempts');
          break;
        case 'auth/network-request-failed':
          errorMessage = t('connection_error');
          break;
        default:
          errorMessage = t('unknown_error');
      }
      
      Alert.alert(t('error'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Navigate to registration screen
  const navigateToRegistration = () => {
    navigation.navigate('Registration');
  };

  // Navigate to forgot password screen
  const navigateToForgotPassword = () => {
    // This would be implemented in a real app
    Alert.alert(t('reset_password'), t('feature_coming_soon'));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.default }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerContainer}>
            <Text style={[styles.title, { color: theme.colors.text.primary }]}>
              {t('app_name')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
              {t('login')}
            </Text>
          </View>
          
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: theme.colors.background.paper,
                    color: theme.colors.text.primary,
                    borderColor: emailError ? theme.colors.error.main : theme.colors.divider,
                    textAlign: isRTL ? 'right' : 'left'
                  }
                ]}
                placeholder={t('email')}
                placeholderTextColor={theme.colors.text.hint}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                onBlur={() => validateEmail(email)}
              />
              {emailError ? (
                <Text style={[styles.errorText, { color: theme.colors.error.main }]}>
                  {emailError}
                </Text>
              ) : null}
            </View>
            
            {/* Password Input */}
            <View style={styles.inputContainer}>
              <View style={[
                styles.passwordContainer,
                { 
                  backgroundColor: theme.colors.background.paper,
                  borderColor: passwordError ? theme.colors.error.main : theme.colors.divider
                }
              ]}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    { 
                      color: theme.colors.text.primary,
                      textAlign: isRTL ? 'right' : 'left'
                    }
                  ]}
                  placeholder={t('password')}
                  placeholderTextColor={theme.colors.text.hint}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  onBlur={() => validatePassword(password)}
                />
                <TouchableOpacity
                  style={styles.visibilityToggle}
                  onPress={togglePasswordVisibility}
                >
                  <Icon
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={theme.colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
              {passwordError ? (
                <Text style={[styles.errorText, { color: theme.colors.error.main }]}>
                  {passwordError}
                </Text>
              ) : null}
            </View>
            
            {/* Forgot Password Link */}
            <TouchableOpacity
              style={[styles.forgotPasswordContainer, { alignSelf: isRTL ? 'flex-start' : 'flex-end' }]}
              onPress={navigateToForgotPassword}
            >
              <Text style={[styles.forgotPasswordText, { color: theme.colors.primary.main }]}>
                {t('forgot_password')}
              </Text>
            </TouchableOpacity>
            
            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.colors.primary.main }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.buttonText}>{t('login')}</Text>
              )}
            </TouchableOpacity>
            
            {/* Sign Up Link */}
            <View style={styles.signupContainer}>
              <Text style={[styles.signupText, { color: theme.colors.text.secondary }]}>
                {t('dont_have_account')}
              </Text>
              <TouchableOpacity onPress={navigateToRegistration}>
                <Text style={[styles.signupLink, { color: theme.colors.primary.main }]}>
                  {t('signup')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  headerContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  visibilityToggle: {
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  forgotPasswordContainer: {
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
    marginRight: 4,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
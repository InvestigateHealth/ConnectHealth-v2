// src/screens/RegistrationScreen.js
// User registration screen

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { AuthService } from '../services/FirebaseService';
import { useTheme } from '../theme/ThemeContext';
import { Button, TextInput } from '../components/Button';

const RegistrationScreen = ({ navigation }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { theme } = useTheme();

  // Clear error message when inputs change
  useEffect(() => {
    if (errorMessage) setErrorMessage('');
  }, [firstName, lastName, email, password, confirmPassword]);

  const validateForm = () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setErrorMessage('Please fill in all fields');
      return false;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      return false;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleRegistration = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrorMessage('');

    try {
      // Create user authentication
      const userCredential = await AuthService.signUp(email.trim(), password);
      
      // The UserContext will handle the rest when auth state changes,
      // including creating the user document in Firestore
      
      // When the user document is created in UserContext.js,
      // it will include firstName and lastName from the form
      await AuthService.updateProfile(userCredential.user, {
        firstName: firstName.trim(),
        lastName: lastName.trim()
      });

      Alert.alert(
        'Registration Successful',
        'Your account has been created. Please complete your profile to get the most out of HealthConnect.',
        [{ text: 'OK' }]
      );
      
      // The app navigator will automatically redirect to the main app
      // once the user is authenticated
    } catch (error) {
      console.error('Registration error:', error);
      let message = 'Failed to create account. Please try again.';
      
      // Handle specific Firebase auth errors
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email address is already in use';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address format';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak. Choose a stronger password.';
      }
      
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background.default }]}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            Create Account
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
            Join HealthConnect to connect with others on similar health journeys
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.nameRow}>
            <TextInput
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
              style={styles.nameInput}
            />

            <TextInput
              label="Last Name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
              style={styles.nameInput}
            />
          </View>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            icon="mail-outline"
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            secureTextEntry
            icon="lock-closed-outline"
          />

          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm your password"
            secureTextEntry
            icon="shield-checkmark-outline"
          />

          {errorMessage ? (
            <Text style={[styles.errorText, { color: theme.colors.error.main }]}>
              {errorMessage}
            </Text>
          ) : null}

          <Text style={[styles.termsText, { color: theme.colors.text.secondary }]}>
            By creating an account, you agree to our Terms of Service and Privacy Policy
          </Text>

          <Button
            title="Create Account"
            onPress={handleRegistration}
            variant="primary"
            loading={loading}
            style={styles.registerButton}
          />

          <Button
            title="Already have an account? Sign In"
            onPress={() => navigation.navigate('Login')}
            variant="text"
            style={styles.loginButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nameInput: {
    flex: 0.48,
  },
  errorText: {
    fontSize: 14,
    marginVertical: 16,
    textAlign: 'center',
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 16,
  },
  registerButton: {
    marginBottom: 16,
  },
  loginButton: {
    marginBottom: 30,
  },
});

export default RegistrationScreen;

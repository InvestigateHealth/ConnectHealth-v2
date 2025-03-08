// src/hooks/useSecureAuth.js
// Custom hook for secure authentication with additional security features

import { useState, useEffect, useCallback } from 'react';
import auth from '@react-native-firebase/auth';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from '../services/FirebaseService';
import { retry } from '../services/RetryService';

/**
 * Custom hook for secure authentication
 * Provides enhanced security features over the base Firebase authentication
 */
export const useSecureAuth = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);

  // Constants for security measures
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
  const TOKEN_REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes
  const SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours
  
  /**
   * Load security settings from storage
   */
  const loadSecuritySettings = async () => {
    try {
      const storedLoginAttempts = await AsyncStorage.getItem('login_attempts');
      const storedLockoutUntil = await AsyncStorage.getItem('lockout_until');
      
      if (storedLoginAttempts) {
        setLoginAttempts(parseInt(storedLoginAttempts, 10));
      }
      
      if (storedLockoutUntil) {
        const lockoutTime = parseInt(storedLockoutUntil, 10);
        
        // Check if lockout is still valid
        if (lockoutTime > Date.now()) {
          setLockoutUntil(lockoutTime);
        } else {
          // Lockout has expired, reset attempts
          await AsyncStorage.removeItem('lockout_until');
          await AsyncStorage.setItem('login_attempts', '0');
          setLoginAttempts(0);
        }
      }
    } catch (error) {
      console.error('Error loading security settings:', error);
    }
  };
  
  /**
   * Initialize auth state listener
   */
  useEffect(() => {
    loadSecuritySettings();
    
    const subscriber = auth().onAuthStateChanged(authUser => {
      setUser(authUser);
      if (initializing) setInitializing(false);
      
      // Reset login attempts on successful login
      if (authUser) {
        setLoginAttempts(0);
        AsyncStorage.setItem('login_attempts', '0');
        AsyncStorage.removeItem('lockout_until');
        
        // Set up session timeout
        setupSessionTimeout();
        
        // Set up token refresh
        setupTokenRefresh();
      }
    });
    
    // Cleanup subscription
    return subscriber;
  }, []);
  
  /**
   * Set up session timeout
   */
  const setupSessionTimeout = () => {
    // Get last activity timestamp
    AsyncStorage.getItem('last_activity').then(lastActivity => {
      if (lastActivity) {
        const lastActivityTime = parseInt(lastActivity, 10);
        const currentTime = Date.now();
        
        // If session has timed out, log out
        if (currentTime - lastActivityTime > SESSION_TIMEOUT) {
          signOut();
          Alert.alert(
            'Session Expired',
            'Your session has expired due to inactivity. Please sign in again.'
          );
        }
      }
      
      // Update last activity timestamp
      AsyncStorage.setItem('last_activity', Date.now().toString());
    });
    
    // Set interval to check for session timeout
    const interval = setInterval(() => {
      AsyncStorage.getItem('last_activity').then(lastActivity => {
        if (lastActivity) {
          const lastActivityTime = parseInt(lastActivity, 10);
          const currentTime = Date.now();
          
          if (currentTime - lastActivityTime > SESSION_TIMEOUT) {
            clearInterval(interval);
            signOut();
            Alert.alert(
              'Session Expired',
              'Your session has expired due to inactivity. Please sign in again.'
            );
          }
        }
      });
    }, 60000); // Check every minute
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  };
  
  /**
   * Set up token refresh
   */
  const setupTokenRefresh = () => {
    const interval = setInterval(async () => {
      if (auth().currentUser) {
        try {
          // Force token refresh
          await auth().currentUser.getIdToken(true);
        } catch (error) {
          console.error('Error refreshing token:', error);
        }
      }
    }, TOKEN_REFRESH_INTERVAL);
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  };
  
  /**
   * Update activity timestamp
   */
  const updateActivity = useCallback(() => {
    if (user) {
      AsyncStorage.setItem('last_activity', Date.now().toString());
    }
  }, [user]);
  
  /**
   * Sign in with email and password
   *
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User credentials
   */
  const signIn = async (email, password) => {
    try {
      // Check if account is locked out
      if (lockoutUntil && Date.now() < lockoutUntil) {
        const remainingMinutes = Math.ceil((lockoutUntil - Date.now()) / 60000);
        throw new Error(`Account is temporarily locked due to multiple failed attempts. Please try again in ${remainingMinutes} minutes.`);
      }
      
      setLoading(true);
      setAuthError(null);
      
      // Attempt login with retry capability
      const userCredential = await retry(
        () => AuthService.signIn(email, password),
        { maxRetries: 2, initialDelay: 1000 }
      );
      
      // Reset login attempts on success
      setLoginAttempts(0);
      await AsyncStorage.setItem('login_attempts', '0');
      await AsyncStorage.removeItem('lockout_until');
      
      // Set last activity timestamp
      await AsyncStorage.setItem('last_activity', Date.now().toString());
      
      return userCredential;
    } catch (error) {
      console.error('Secure sign-in error:', error);
      setAuthError(error.message);
      
      // Increment login attempts for failed login
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      await AsyncStorage.setItem('login_attempts', newAttempts.toString());
      
      // Check if account should be locked
      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockoutTime = Date.now() + LOCKOUT_DURATION;
        setLockoutUntil(lockoutTime);
        await AsyncStorage.setItem('lockout_until', lockoutTime.toString());
        
        throw new Error(`Too many failed login attempts. Your account has been temporarily locked for ${LOCKOUT_DURATION/60000} minutes.`);
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Sign up with email and password
   *
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} User credentials
   */
  const signUp = async (email, password) => {
    try {
      setLoading(true);
      setAuthError(null);
      
      // Validate password strength
      if (!isStrongPassword(password)) {
        throw new Error('Password must be at least 8 characters long and include uppercase, lowercase, numbers, and special characters.');
      }
      
      // Create user with retry capability
      const userCredential = await retry(
        () => AuthService.signUp(email, password),
        { maxRetries: 2, initialDelay: 1000 }
      );
      
      // Set last activity timestamp
      await AsyncStorage.setItem('last_activity', Date.now().toString());
      
      return userCredential;
    } catch (error) {
      console.error('Secure sign-up error:', error);
      setAuthError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Sign out the current user
   */
  const signOut = async () => {
    try {
      setLoading(true);
      
      // Clean up storage
      await AsyncStorage.removeItem('last_activity');
      
      // Sign out with retry capability
      await retry(
        () => AuthService.signOut(),
        { maxRetries: 2, initialDelay: 1000 }
      );
    } catch (error) {
      console.error('Secure sign-out error:', error);
      setAuthError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Reset password
   *
   * @param {string} email - User email
   * @returns {Promise<void>}
   */
  const resetPassword = async (email) => {
    try {
      setLoading(true);
      setAuthError(null);
      
      await retry(
        () => AuthService.resetPassword(email),
        { maxRetries: 2, initialDelay: 1000 }
      );
    } catch (error) {
      console.error('Reset password error:', error);
      setAuthError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Update current user password
   *
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  const updatePassword = async (currentPassword, newPassword) => {
    try {
      setLoading(true);
      setAuthError(null);
      
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      // Validate password strength
      if (!isStrongPassword(newPassword)) {
        throw new Error('Password must be at least 8 characters long and include uppercase, lowercase, numbers, and special characters.');
      }
      
      // First reauthenticate
      const credential = auth.EmailAuthProvider.credential(
        user.email,
        currentPassword
      );
      
      await user.reauthenticateWithCredential(credential);
      
      // Then update password
      await user.updatePassword(newPassword);
      
      // Update last activity timestamp
      await AsyncStorage.setItem('last_activity', Date.now().toString());
    } catch (error) {
      console.error('Update password error:', error);
      setAuthError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Check if password is strong enough
   *
   * @param {string} password - Password to check
   * @returns {boolean} Whether password is strong
   */
  const isStrongPassword = (password) => {
    // At least 8 characters, with uppercase, lowercase, numbers, and special characters
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
  };
  
  /**
   * Get remaining lockout time in minutes
   *
   * @returns {number|null} Remaining lockout time in minutes or null if not locked
   */
  const getRemainingLockoutTime = () => {
    if (!lockoutUntil || Date.now() >= lockoutUntil) {
      return null;
    }
    
    return Math.ceil((lockoutUntil - Date.now()) / 60000);
  };
  
  /**
   * Get session timeout in minutes
   * 
   * @returns {Promise<number|null>} Remaining session time in minutes or null if no session
   */
  const getRemainingSessionTime = async () => {
    if (!user) return null;
    
    try {
      const lastActivity = await AsyncStorage.getItem('last_activity');
      if (!lastActivity) return null;
      
      const lastActivityTime = parseInt(lastActivity, 10);
      const elapsedTime = Date.now() - lastActivityTime;
      const remainingTime = SESSION_TIMEOUT - elapsedTime;
      
      if (remainingTime <= 0) return 0;
      
      return Math.ceil(remainingTime / 60000);
    } catch (error) {
      console.error('Error getting remaining session time:', error);
      return null;
    }
  };
  
  return {
    user,
    initializing,
    loading,
    authError,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateActivity,
    isAccountLocked: !!lockoutUntil && Date.now() < lockoutUntil,
    getRemainingLockoutTime,
    getRemainingSessionTime,
    clearAuthError: () => setAuthError(null)
  };
};

export default useSecureAuth;

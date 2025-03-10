// App.js
// Main app entry point - Production ready version with i18n support and optimized initialization

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, StatusBar, View, Text, AppState, I18nManager } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Config from 'react-native-config';
import { LogBox } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import notifee from '@notifee/react-native';
import { useTranslation } from 'react-i18next';

// Import screens
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import AppNavigator from './src/navigation/AppNavigator';
import LanguageSettingsScreen from './src/screens/LanguageSettingsScreen';

// Import providers
import { UserProvider, useUser } from './src/contexts/UserContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { NetworkProvider, useNetwork } from './src/contexts/NetworkContext';
import { AccessibilityProvider } from './src/contexts/AccessibilityContext';
import { BlockedUsersProvider } from './src/contexts/BlockedUsersContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Import utilities
import { initializeDeepLinking, cleanupDeepLinking } from './src/utils/deepLinking';
import { AnalyticsService } from './src/services/AnalyticsService';
import notificationService from './src/services/NotificationService';
import navigationService from './src/services/NavigationService';
import { formatDistanceToNow } from 'date-fns';

// Import internationalization
import './src/i18n';

// RTL support is now fully handled via Language Context Provider
import { LanguageProvider } from './src/contexts/LanguageContext';
import * as Keychain from 'react-native-keychain';

// Ignore specific warnings
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'AsyncStorage has been extracted from react-native',
  'Non-serializable values were found in the navigation state',
]);

const Stack = createStackNavigator();

// Create a loading component to show during initialization
const InitializingApp = ({ progress, appVersion }) => (
  <View style={{ 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#FFFFFF' 
  }}>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={{ marginTop: 10, color: '#000000' }}>
      {progress}
    </Text>
    
    <Text style={{ 
      position: 'absolute',
      bottom: 10,
      fontSize: 10,
      color: '#666666'
    }}>
      {appVersion}
    </Text>
  </View>
);

const App = () => {
  // Reference to the navigation container
  const navigationRef = useRef(null);
  
  // Track initialization progress for better user feedback
  const [initProgress, setInitProgress] = useState('Loading...');
  const [appVersion, setAppVersion] = useState('');
  
  // Set up app version info
  useEffect(() => {
    const getAppInfo = async () => {
      try {
        const version = await DeviceInfo.getVersion();
        const buildNumber = await DeviceInfo.getBuildNumber();
        setAppVersion(`v${version} (${buildNumber})`);
      } catch (error) {
        console.error('Error getting app version:', error);
        setAppVersion('Unknown version');
      }
    };
    
    getAppInfo();
  }, []);
  
  // Initialize essential services in parallel for faster startup
  useEffect(() => {
    const initializeServices = async () => {
      try {
        setInitProgress('Initializing services...');
        
        // Start initializing services in parallel
        const initPromises = [
          // Initialize services that don't depend on user auth first
          AnalyticsService.initialize(),
          // Pre-load cached data where possible
          AsyncStorage.getItem('userLanguage'),
          AsyncStorage.getItem('theme'),
          // Add other initialization tasks that can be done in parallel
        ];
        
        // Wait for parallel initialization to complete
        await Promise.all(initPromises);
        
        setInitProgress('Ready');
      } catch (error) {
        console.error('Error during service initialization:', error);
        setInitProgress('Ready');
      }
    };
    
    initializeServices();
  }, []);
  
  // Initialize navigation services when the ref is ready
  useEffect(() => {
    if (navigationRef.current) {
      navigationService.setNavigationRef(navigationRef);
    }
  }, [navigationRef.current]);
  
  // Initialize deep linking when the app is ready
  useEffect(() => {
    let cleanupFunction = () => {};
    
    if (navigationRef.current) {
      try {
        cleanupFunction = initializeDeepLinking(navigationRef.current);
      } catch (error) {
        console.error('Deep linking initialization error:', error);
      }
    }
    
    return () => {
      try {
        if (typeof cleanupFunction === 'function') {
          cleanupFunction();
        } else {
          cleanupDeepLinking();
        }
      } catch (error) {
        console.error('Deep linking cleanup error:', error);
      }
    };
  }, [navigationRef.current]);
  
  // Track app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        // App came to foreground
        AnalyticsService.logEvent('app_foreground');
      } else if (nextAppState === 'background') {
        // App went to background
        AnalyticsService.logEvent('app_background');
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Set up notification listeners
  useEffect(() => {
    // Set up foreground handler for notifications
    const unsubscribeForeground = notifee.onForegroundEvent(({ type, detail }) => {
      switch (type) {
        case notifee.EventType.PRESS:
          // Handle notification press by passing to navigation service
          navigationService.handleDeepLink(detail.notification?.data?.deepLink);
          break;
        case notifee.EventType.ACTION_PRESS:
          // Handle action press
          break;
      }
    });

    // Return cleanup function
    return () => {
      unsubscribeForeground();
      
      // Clean up notification service
      notificationService.cleanup();
    };
  }, []);
  
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NetworkProvider>
            <ThemeProvider>
              <AccessibilityProvider>
                <LanguageProvider>
                  <UserProvider>
                    <BlockedUsersProvider>
                      <NavigationContainer ref={navigationRef}>
                        <AppContent initProgress={initProgress} />
                      </NavigationContainer>
                    </BlockedUsersProvider>
                  </UserProvider>
                </LanguageProvider>
              </AccessibilityProvider>
            </ThemeProvider>
          </NetworkProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

const AppContent = ({ initProgress }) => {
  // State management
  const [initializing, setInitializing] = useState(true);
  const { user, userData, setUserData, setUser, loading } = useUser();
  const { theme, isDarkMode } = useTheme();
  const { isConnected, isInternetReachable, setOfflineMode } = useNetwork();
  const [localOfflineMode, setLocalOfflineMode] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const { t, i18n } = useTranslation();
  
  // Get app version for display
  useEffect(() => {
    async function getAppInfo() {
      try {
        const version = await DeviceInfo.getVersion();
        const buildNumber = await DeviceInfo.getBuildNumber();
        setAppVersion(`v${version} (${buildNumber})`);
      } catch (error) {
        console.error('Error getting app version:', error);
        setAppVersion('Unknown version');
      }
    }
    
    getAppInfo();
  }, []);

  // Configure RTL layout for appropriate languages
  useEffect(() => {
    const configureRTL = async () => {
      // Arabic and Hebrew are RTL languages
      const isRTL = i18n.language === 'ar' || i18n.language === 'he';
      
      // Only update if the RTL setting needs to change
      if (I18nManager.isRTL !== isRTL) {
        I18nManager.forceRTL(isRTL);
      }
    };
    
    configureRTL();
  }, [i18n.language]);
  
  // Handle network status 
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isOffline = !state.isConnected || !state.isInternetReachable;
      setLocalOfflineMode(isOffline);
      setOfflineMode(isOffline);
      
      // If we're coming back online, refresh user data
      if (state.isConnected && state.isInternetReachable && localOfflineMode && user) {
        refreshUserData(user.uid);
      }
    });
    
    return () => unsubscribe();
  }, [isConnected, isInternetReachable, localOfflineMode, user]);

  // Function to refresh user data - Optimized to load from cache first then update
  const refreshUserData = async (userId) => {
    try {
      if (!userId) return;
      
      // First try to get cached data for immediate UI update
      const cachedData = await AsyncStorage.getItem(`user_${userId}`);
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        setUserData(parsedData);
        setLastSyncTime(parsedData._cachedAt);
      }
      
      // Then fetch fresh data from Firestore in background
      if (isConnected && isInternetReachable) {
        const userDoc = await firestore().collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          setUserData(userData);
          
          // Update local cache
          const timestamp = Date.now();
          await AsyncStorage.setItem(`user_${userId}`, JSON.stringify({
            ...userData,
            _cachedAt: timestamp
          }));
          
          setLastSyncTime(timestamp);
          
          // Log successful sync
          AnalyticsService.logEvent('user_data_synced', {
            success: true,
            timestamp: timestamp
          });
        }
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
      
      // Log sync error
      AnalyticsService.logEvent('user_data_sync_error', {
        error: error.message,
        timestamp: Date.now()
      });
    }
  };

  // Enhanced authentication state handling with secure credential storage using Keychain
  const onAuthStateChanged = useCallback(async (authUser) => {
    setUser(authUser);

    if (authUser) {
      // Initialize notification service
      await notificationService.initialize(authUser.uid);
      
      // Identify user for analytics
      AnalyticsService.identifyUser(authUser.uid);
      
      // Log app launch with user
      AnalyticsService.logEvent('app_launch', { 
        logged_in: true,
        app_version: appVersion
      });
      
      // Try to get cached data first for immediate UI update
      try {
        const cachedUserData = await AsyncStorage.getItem(`user_${authUser.uid}`);
        if (cachedUserData) {
          const parsedData = JSON.parse(cachedUserData);
          setUserData(parsedData);
          setLastSyncTime(parsedData._cachedAt);
        }
      } catch (cacheError) {
        console.error('Error reading cached user data:', cacheError);
      }

      // Securely store auth credentials to enable auto-login
      try {
        // Store authentication state securely
        await Keychain.setGenericPassword(
          authUser.email,
          authUser.uid,
          { service: 'auth_state' }
        );
      } catch (credentialError) {
        console.error('Error storing authentication credentials:', credentialError);
      }

      // Fetch fresh data from Firestore if online
      const networkState = await NetInfo.fetch();
      if (networkState.isConnected && networkState.isInternetReachable) {
        try {
          const userDoc = await firestore().collection('users').doc(authUser.uid).get();
          if (userDoc.exists) {
            const freshUserData = userDoc.data();
            setUserData(freshUserData);
            
            const timestamp = Date.now();
            // Update cache
            await AsyncStorage.setItem(`user_${authUser.uid}`, JSON.stringify({
              ...freshUserData,
              _cachedAt: timestamp
            }));
            
            setLastSyncTime(timestamp);
          } else {
            // User document doesn't exist but user is authenticated
            // This might happen if account creation failed midway
            console.warn('User authenticated but no Firestore document exists');
            
            // Create a basic user document to prevent future issues
            try {
              const userInfo = {
                uid: authUser.uid,
                email: authUser.email || '',
                displayName: authUser.displayName || '',
                photoURL: authUser.photoURL || '',
                createdAt: firestore.FieldValue.serverTimestamp(),
                lastLogin: firestore.FieldValue.serverTimestamp(),
                // Default settings
                settings: {
                  notifications: true,
                  darkMode: false,
                  privacyLevel: 'standard',
                  language: i18n.language || 'en', // Store user's language preference
                },
                isProfileComplete: false,
              };
              
              await firestore().collection('users').doc(authUser.uid).set(userInfo);
              setUserData(userInfo);
              
              const timestamp = Date.now();
              await AsyncStorage.setItem(`user_${authUser.uid}`, JSON.stringify({
                ...userInfo,
                _cachedAt: timestamp
              }));
              
              setLastSyncTime(timestamp);
            } catch (createError) {
              console.error('Error creating user document:', createError);
              setLocalOfflineMode(true);
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setLocalOfflineMode(true);
        }
      } else {
        // We're offline, use cached data only
        setLocalOfflineMode(true);
      }
    } else {
      setUserData(null);
      setLastSyncTime(null);
      setLocalOfflineMode(false);
      
      // Remove stored credentials on logout
      try {
        await Keychain.resetGenericPassword({ service: 'auth_state' });
      } catch (credentialError) {
        console.error('Error resetting authentication credentials:', credentialError);
      }
      
      // Reset notifications when user logs out
      await notificationService.cleanup();
      
      // Reset analytics user
      AnalyticsService.resetUser();
      
      // Log app launch without user
      AnalyticsService.logEvent('app_launch', { 
        logged_in: false,
        app_version: appVersion
      });
    }

    if (initializing) setInitializing(false);
  }, [appVersion, i18n.language, initializing, setUser]);

  // Auth state change listener
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, [onAuthStateChanged]);

  // Try to auto-login with stored credentials
  useEffect(() => {
    const tryAutoLogin = async () => {
      // Only try auto-login if no user is currently logged in
      if (!user && !loading) {
        try {
          // Check if we have stored credentials
          const credentials = await Keychain.getGenericPassword({ service: 'auth_state' });
          
          if (credentials) {
            const { username: email, password: uid } = credentials;
            
            // Check if we have a stored auth token for faster login
            const authToken = await AsyncStorage.getItem('authToken');
            
            if (authToken) {
              // If we have an auth token, use it to sign in faster
              // This is where you could implement biometric authentication
              setInitProgress('Logging in...');
              
              // We don't actually sign in here, since the auth state listener
              // will pick up the existing authentication
              // Just use this to show a nice login message
            }
          }
        } catch (error) {
          console.error('Auto-login error:', error);
        }
      }
    };
    
    tryAutoLogin();
  }, [user, loading]);
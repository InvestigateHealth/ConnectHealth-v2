// App.js
// Main app entry point - Production ready version with i18n support

import React, { useState, useEffect, useRef } from 'react';
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
import { formatDistanceToNow } from 'date-fns';

// Import internationalization
import './src/i18n';

// RTL support is now fully handled via Language Context Provider
import { LanguageProvider } from './src/contexts/LanguageContext';

// Ignore specific warnings
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'AsyncStorage has been extracted from react-native',
  'Non-serializable values were found in the navigation state',
]);

const Stack = createStackNavigator();

const App = () => {
  // Reference to the navigation container
  const navigationRef = useRef(null);
  
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
          // Handle notification press
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
                        <AppContent />
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

const AppContent = () => {
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
        
        // Reload the app to apply RTL changes
        // This is needed for proper RTL layout on Android
        // Note: In a production app, you might want to show a dialog first
        // to explain to the user that the app will restart
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

  // Function to refresh user data
  const refreshUserData = async (userId) => {
    try {
      if (!userId) return;
      
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
    } catch (error) {
      console.error('Error refreshing user data:', error);
      
      // Log sync error
      AnalyticsService.logEvent('user_data_sync_error', {
        error: error.message,
        timestamp: Date.now()
      });
    }
  };

  // Handle user state changes
  async function onAuthStateChanged(authUser) {
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
  }

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, []);

  // Show loading indicator while initializing Firebase
  if (initializing || loading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: theme?.colors?.background?.default || '#FFFFFF' 
      }}>
        <ActivityIndicator 
          size="large" 
          color={theme?.colors?.primary?.main || '#007AFF'} 
        />
        <Text style={{ 
          marginTop: 10,
          color: theme?.colors?.text?.primary || '#000000' 
        }}>
          {t('loading')}
        </Text>
        
        <Text style={{ 
          position: 'absolute',
          bottom: 10,
          fontSize: 10,
          color: theme?.colors?.text?.secondary || '#666666'
        }}>
          {appVersion}
        </Text>
      </View>
    );
  }

  // Display offline banner if necessary
  const OfflineBanner = () => {
    if (!isConnected || !isInternetReachable) {
      return (
        <View style={{
          backgroundColor: '#FFA000',
          padding: 5,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
            {t('offline_mode')}
          </Text>
        </View>
      );
    }
    return null;
  };

  // Format last sync time display
  const getLastSyncDisplay = () => {
    if (!lastSyncTime) return '';
    
    try {
      return t('last_synced', { time: formatDistanceToNow(lastSyncTime, { addSuffix: true }) });
    } catch (error) {
      return '';
    }
  };

  return (
    <>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={theme?.colors?.background?.paper || '#FFFFFF'}
      />
      {!isConnected && <OfflineBanner />}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            {!Config.SKIP_ONBOARDING && (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            )}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Registration" component={RegistrationScreen} />
          </>
        ) : (
          <Stack.Screen 
            name="Main" 
            component={AppNavigator} 
            initialParams={{ offlineMode: localOfflineMode }} 
          />
        )}
      </Stack.Navigator>
      
      <View style={{ 
        position: 'absolute',
        bottom: 0,
        right: 0,
        padding: 3,
        backgroundColor: 'transparent',
        flexDirection: 'column',
        alignItems: 'flex-end'
      }}>
        {lastSyncTime && (
          <Text style={{ 
            fontSize: 7,
            color: theme?.colors?.text?.hint || '#999999',
            opacity: 0.7,
            marginBottom: 1
          }}>
            {getLastSyncDisplay()}
          </Text>
        )}
        <Text style={{ 
          fontSize: 8,
          color: theme?.colors?.text?.hint || '#999999',
          opacity: 0.5
        }}>
          {appVersion}
        </Text>
      </View>
    </>
  );
};

export default App;
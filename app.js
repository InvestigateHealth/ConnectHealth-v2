// App.js
// Main app entry point - Updated for production

import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, StatusBar, View, Text, Platform, AppState } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Config from 'react-native-config';
import { LogBox } from 'react-native';
import DeviceInfo from 'react-native-device-info';

// Import screens
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';

// Import providers
import { UserProvider, useUser } from './src/contexts/UserContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { NetworkProvider, useNetwork } from './src/contexts/NetworkContext';
import { AccessibilityProvider } from './src/contexts/AccessibilityContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Import utilities
import { initializeDeepLinking, cleanupDeepLinking } from './src/utils/deepLinking';
import { AnalyticsService } from './src/services/AnalyticsService';

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
    if (navigationRef.current) {
      initializeDeepLinking(navigationRef.current);
    }
    
    return () => {
      cleanupDeepLinking();
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
  
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NetworkProvider>
            <ThemeProvider>
              <AccessibilityProvider>
                <UserProvider>
                  <NavigationContainer ref={navigationRef}>
                    <AppContent />
                  </NavigationContainer>
                </UserProvider>
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
  const [offlineMode, setLocalOfflineMode] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  
  // Get app version for display
  useEffect(() => {
    setAppVersion(`v${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`);
  }, []);
  
  // Handle network status 
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isOffline = !state.isConnected || !state.isInternetReachable;
      setLocalOfflineMode(isOffline);
      setOfflineMode(isOffline);
      
      // If we're coming back online, refresh user data
      if (state.isConnected && state.isInternetReachable && offlineMode && user) {
        refreshUserData(user.uid);
      }
    });
    
    return () => unsubscribe();
  }, [isConnected, isInternetReachable, offlineMode, user]);

  // Function to refresh user data
  const refreshUserData = async (userId) => {
    try {
      if (!userId) return;
      
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        setUserData(userData);
        
        // Update local cache
        await AsyncStorage.setItem(`user_${userId}`, JSON.stringify({
          ...userData,
          _cachedAt: Date.now()
        }));
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  // Handle user state changes
  async function onAuthStateChanged(authUser) {
    setUser(authUser);

    if (authUser) {
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
          setUserData(JSON.parse(cachedUserData));
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
            
            // Update cache
            await AsyncStorage.setItem(`user_${authUser.uid}`, JSON.stringify({
              ...freshUserData,
              _cachedAt: Date.now()
            }));
          } else {
            // User document doesn't exist but user is authenticated
            // This might happen if account creation failed midway
            console.warn('User authenticated but no Firestore document exists');
            setLocalOfflineMode(true);
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
      setLocalOfflineMode(false);
      
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
          Loading...
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
            You are offline. Some features may be limited.
          </Text>
        </View>
      );
    }
    return null;
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
            component={MainTabNavigator} 
            initialParams={{ offlineMode: offlineMode }} 
          />
        )}
      </Stack.Navigator>
      
      <View style={{ 
        position: 'absolute',
        bottom: 0,
        right: 0,
        padding: 2,
        backgroundColor: 'transparent'
      }}>
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

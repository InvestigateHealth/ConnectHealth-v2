// App.js
// Main app entry point

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, StatusBar, View, Text } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Import screens
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';

// Import providers
import { UserProvider, useUser } from './src/contexts/UserContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { NetworkProvider } from './src/contexts/NetworkContext';

const Stack = createStackNavigator();

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NetworkProvider>
          <ThemeProvider>
            <UserProvider>
              <AppContent />
            </UserProvider>
          </ThemeProvider>
        </NetworkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const AppContent = () => {
  // State management
  const [initializing, setInitializing] = useState(true);
  const { user, userData, setUserData, setUser, loading } = useUser();
  const { theme, isDarkMode } = useTheme();
  const [isConnected, setIsConnected] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  // Handle network status 
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      
      // If we're coming back online, refresh user data
      if (state.isConnected && !isConnected && user) {
        refreshUserData(user.uid);
      }
    });
    
    return () => unsubscribe();
  }, [isConnected, user]);

  // Function to refresh user data
  const refreshUserData = async (userId) => {
    try {
      if (!userId) return;
      
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        setUserData(userDoc.data());
        
        // Update local cache
        await AsyncStorage.setItem(`user_${userId}`, JSON.stringify({
          ...userDoc.data(),
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
      if (networkState.isConnected) {
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
            setOfflineMode(true);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setOfflineMode(true);
        }
      } else {
        // We're offline, use cached data only
        setOfflineMode(true);
      }
    } else {
      setUserData(null);
      setOfflineMode(false);
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
      </View>
    );
  }

  // Display offline banner if necessary
  const OfflineBanner = () => {
    if (!isConnected) {
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
      <NavigationContainer theme={theme?.navigation}>
        {!isConnected && <OfflineBanner />}
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Registration" component={RegistrationScreen} />
            </>
          ) : (
            <Stack.Screen 
              name="Main" 
              component={MainTabNavigator} 
              initialParams={{ offlineMode }} 
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default App;

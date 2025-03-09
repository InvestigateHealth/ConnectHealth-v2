// App.js
// Main app entry point

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, StatusBar } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Import screens
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';

// Import providers
import { UserProvider, useUser } from './src/contexts/UserContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

const Stack = createStackNavigator();

const App = () => {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

const AppContent = () => {
  // State management
  const [initializing, setInitializing] = useState(true);
  const { user, userData, setUserData, setUser, loading } = useUser();
  const { theme, isDarkMode } = useTheme();

  // Handle user state changes
  async function onAuthStateChanged(authUser) {
    setUser(authUser);

    if (authUser) {
      // Fetch additional user data from Firestore
      try {
        const userDoc = await firestore().collection('users').doc(authUser.uid).get();
        if (userDoc.exists) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    } else {
      setUserData(null);
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
      <ActivityIndicator 
        size="large" 
        color={theme?.colors?.primary?.main || '#007AFF'} 
        style={{ flex: 1, backgroundColor: theme?.colors?.background?.default || '#FFFFFF' }} 
      />
    );
  }

  return (
    <>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={theme?.colors?.background?.paper || '#FFFFFF'}
      />
      <NavigationContainer theme={theme?.navigation}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <>
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Registration" component={RegistrationScreen} />
            </>
          ) : (
            <Stack.Screen name="Main" component={MainTabNavigator} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default App;

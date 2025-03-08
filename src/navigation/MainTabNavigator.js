// src/navigation/MainTabNavigator.js
// Tab navigation for authenticated users - Updated with theme support

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';

// Import screens
import FeedScreen from '../screens/FeedScreen';
import ExploreScreen from '../screens/ExploreScreen';
import NewPostScreen from '../screens/NewPostScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CommentsScreen from '../screens/CommentsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ThemeSettingsScreen from '../screens/ThemeSettingsScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Each tab has its own stack navigator for nested screens
const FeedStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.text.primary,
        headerStyle: {
          backgroundColor: theme.colors.background.paper,
          elevation: 1,
          shadowOpacity: 0.3,
        },
      }}
    >
      <Stack.Screen 
        name="Feed" 
        component={FeedScreen} 
        options={{ title: 'Feed' }}
      />
      <Stack.Screen 
        name="Comments" 
        component={CommentsScreen} 
        options={({ route }) => ({ 
          title: route.params?.title || 'Comments' 
        })}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={UserProfileScreen} 
        options={({ route }) => ({ 
          title: route.params?.title || 'Profile' 
        })}
      />
    </Stack.Navigator>
  );
};

const ExploreStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.text.primary,
        headerStyle: {
          backgroundColor: theme.colors.background.paper,
          elevation: 1,
          shadowOpacity: 0.3,
        },
      }}
    >
      <Stack.Screen 
        name="Explore" 
        component={ExploreScreen} 
        options={{ title: 'Explore' }}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={UserProfileScreen} 
        options={({ route }) => ({ 
          title: route.params?.title || 'Profile' 
        })}
      />
    </Stack.Navigator>
  );
};

const ProfileStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.text.primary,
        headerStyle: {
          backgroundColor: theme.colors.background.paper,
          elevation: 1,
          shadowOpacity: 0.3,
        },
      }}
    >
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: 'My Profile' }}
      />
      <Stack.Screen 
        name="Comments" 
        component={CommentsScreen} 
        options={({ route }) => ({ 
          title: route.params?.title || 'Comments' 
        })}
      />
      <Stack.Screen 
        name="BlockedUsers" 
        component={BlockedUsersScreen} 
        options={{ title: 'Blocked Users' }}
      />
      <Stack.Screen 
        name="ThemeSettings" 
        component={ThemeSettingsScreen} 
        options={{ title: 'Appearance' }}
      />
    </Stack.Navigator>
  );
};

const MainTabNavigator = () => {
  const { theme } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'FeedTab') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'ExploreTab') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'NewPost') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary.main,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        tabBarStyle: {
          backgroundColor: theme.colors.background.paper,
          borderTopColor: theme.colors.divider,
        },
        headerShown: false
      })}
    >
      <Tab.Screen 
        name="FeedTab" 
        component={FeedStack} 
        options={{ tabBarLabel: 'Feed' }}
      />
      <Tab.Screen 
        name="ExploreTab" 
        component={ExploreStack} 
        options={{ tabBarLabel: 'Explore' }}
      />
      <Tab.Screen 
        name="NewPost" 
        component={NewPostScreen} 
        options={{ 
          tabBarLabel: 'Post',
          headerShown: true,
          title: 'Create Post'
        }}
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ 
          headerShown: true,
          title: 'Notifications' 
        }}
      />
      <Tab.Screen 
        name="ProfileTab" 
        component={ProfileStack} 
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;

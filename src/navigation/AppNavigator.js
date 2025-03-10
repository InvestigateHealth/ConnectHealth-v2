// src/navigation/AppNavigator.js
// Consolidated navigation system with shared element transitions

import React, { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import { createSharedElementStackNavigator } from 'react-navigation-shared-element';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import Config from 'react-native-config';
import { useNetwork } from '../contexts/NetworkContext';

// Import screens
import FeedScreen from '../screens/FeedScreen';
import ExploreScreen from '../screens/ExploreScreen';
import NewPostScreen from '../screens/NewPostScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CommentsScreen from '../screens/CommentsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ThemeSettingsScreen from '../screens/ThemeSettingsScreen';
import EventsScreen from '../screens/EventsScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import SearchScreen from '../screens/SearchScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';

// Enable react-native-screens for better performance
enableScreens();

// Create navigators
const Stack = createSharedElementStackNavigator();
const Tab = createBottomTabNavigator();

// Feed stack navigator
const FeedStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.text.primary,
        headerStyle: {
          backgroundColor: theme.colors.background.paper,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        },
        cardStyle: { backgroundColor: theme.colors.background.default },
      }}
    >
      <Stack.Screen 
        name="Feed" 
        component={FeedScreen} 
        options={{ headerTitle: 'HealthConnect' }}
      />
      <Stack.Screen 
        name="Comments" 
        component={CommentsScreen} 
        options={({ route }) => ({ 
          title: route.params?.title || 'Comments',
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={UserProfileScreen} 
        options={({ route }) => ({ 
          title: route.params?.title || 'Profile',
          headerBackTitleVisible: false,
        })}
        sharedElements={(route) => {
          const { userId } = route.params;
          return [`user.avatar.${userId}`];
        }}
      />
      <Stack.Screen 
        name="PostDetail" 
        component={PostDetailScreen} 
        options={{ 
          title: 'Post',
          headerBackTitleVisible: false,
        }}
        sharedElements={(route) => {
          const { postId } = route.params;
          return [`post.image.${postId}`];
        }}
      />
      <Stack.Screen 
        name="Search" 
        component={SearchScreen} 
        options={{ 
          title: 'Search',
          headerBackTitleVisible: false, 
        }}
      />
      <Stack.Screen 
        name="EventDetail" 
        component={EventDetailScreen} 
        options={{ 
          title: 'Event',
          headerBackTitleVisible: false, 
        }}
        sharedElements={(route) => {
          const { eventId } = route.params;
          return [`event.image.${eventId}`];
        }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={({ route }) => ({ 
          title: route.params?.userName || 'Chat',
          headerBackTitleVisible: false,
        })}
      />
    </Stack.Navigator>
  );
};

// Explore stack navigator
const ExploreStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.text.primary,
        headerStyle: {
          backgroundColor: theme.colors.background.paper,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        },
        cardStyle: { backgroundColor: theme.colors.background.default },
      }}
    >
      <Stack.Screen 
        name="Explore" 
        component={ExploreScreen} 
        options={{ title: 'Discover People' }}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={UserProfileScreen} 
        options={({ route }) => ({ 
          title: route.params?.title || 'Profile',
          headerBackTitleVisible: false,
        })}
        sharedElements={(route) => {
          const { userId } = route.params;
          return [`user.avatar.${userId}`];
        }}
      />
      <Stack.Screen 
        name="Search" 
        component={SearchScreen} 
        options={{ 
          title: 'Search',
          headerBackTitleVisible: false, 
        }}
      />
    </Stack.Navigator>
  );
};

// Events stack navigator
const EventsStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.text.primary,
        headerStyle: {
          backgroundColor: theme.colors.background.paper,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        },
        cardStyle: { backgroundColor: theme.colors.background.default },
      }}
    >
      <Stack.Screen 
        name="Events" 
        component={EventsScreen} 
        options={{ title: 'Virtual Events' }}
      />
      <Stack.Screen 
        name="EventDetail" 
        component={EventDetailScreen} 
        options={{ 
          title: 'Event',
          headerBackTitleVisible: false, 
        }}
        sharedElements={(route) => {
          const { eventId } = route.params;
          return [`event.image.${eventId}`];
        }}
      />
    </Stack.Navigator>
  );
};

// Profile stack navigator
const ProfileStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.text.primary,
        headerStyle: {
          backgroundColor: theme.colors.background.paper,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        },
        cardStyle: { backgroundColor: theme.colors.background.default },
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
          title: route.params?.title || 'Comments',
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ 
          title: 'Settings',
          headerBackTitleVisible: false, 
        }}
      />
      <Stack.Screen 
        name="ThemeSettings" 
        component={ThemeSettingsScreen} 
        options={{ 
          title: 'Appearance',
          headerBackTitleVisible: false, 
        }}
      />
      <Stack.Screen 
        name="BlockedUsers" 
        component={BlockedUsersScreen} 
        options={{ 
          title: 'Blocked Users',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen 
        name="PostDetail" 
        component={PostDetailScreen} 
        options={{ 
          title: 'Post',
          headerBackTitleVisible: false,
        }}
        sharedElements={(route) => {
          const { postId } = route.params;
          return [`post.image.${postId}`];
        }}
      />
    </Stack.Navigator>
  );
};

// Chat stack navigator
const ChatStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.text.primary,
        headerStyle: {
          backgroundColor: theme.colors.background.paper,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        },
        cardStyle: { backgroundColor: theme.colors.background.default },
      }}
    >
      <Stack.Screen 
        name="ChatList" 
        component={ChatListScreen} 
        options={{ title: 'Messages' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={({ route }) => ({ 
          title: route.params?.userName || 'Chat',
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={UserProfileScreen} 
        options={({ route }) => ({ 
          title: route.params?.title || 'Profile',
          headerBackTitleVisible: false,
        })}
        sharedElements={(route) => {
          const { userId } = route.params;
          return [`user.avatar.${userId}`];
        }}
      />
    </Stack.Navigator>
  );
};

// Notifications stack navigator
const NotificationsStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: theme.colors.text.primary,
        headerStyle: {
          backgroundColor: theme.colors.background.paper,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.divider,
        },
        cardStyle: { backgroundColor: theme.colors.background.default },
      }}
    >
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={UserProfileScreen} 
        options={({ route }) => ({ 
          title: route.params?.title || 'Profile',
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen 
        name="PostDetail" 
        component={PostDetailScreen} 
        options={{ 
          title: 'Post',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};

// Main tab navigator for authenticated users
const AppNavigator = ({ route }) => {
  const { theme, isDarkMode } = useTheme();
  const { isConnected, isInternetReachable } = useNetwork();
  const { offlineMode } = route.params || {};
  
  // Update status bar based on theme
  useEffect(() => {
    StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(theme.colors.background.paper);
    }
  }, [isDarkMode, theme]);
  
  // Conditionally disable certain tabs when offline
  const isOffline = !isConnected || !isInternetReachable || offlineMode;
  
  // Event tab only available if enabled in config and online
  const eventTabEnabled = Config.ENABLE_EVENTS === 'true' && !isOffline;
  
  // Chat tab only available if enabled in config and online
  const chatTabEnabled = Config.ENABLE_CHAT === 'true' && !isOffline;
  
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
          } else if (route.name === 'ChatTab') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'EventsTab') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'NotificationsTab') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary.main,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.background.paper,
          borderTopColor: theme.colors.divider,
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
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
        options={{ tabBarLabel: 'Discover' }}
      />
      {eventTabEnabled && (
        <Tab.Screen 
          name="EventsTab" 
          component={EventsStack} 
          options={{ tabBarLabel: 'Events' }}
        />
      )}
      <Tab.Screen 
        name="NewPost" 
        component={NewPostScreen} 
        options={{ 
          tabBarLabel: 'Post',
          headerShown: true,
          title: 'Create Post',
          tabBarIcon: ({ color, size, focused }) => (
            <Icon 
              name={focused ? 'add-circle' : 'add-circle-outline'} 
              size={size + 8} 
              color={color} 
              style={{ marginTop: -8 }}
            />
          ),
        }}
      />
      {chatTabEnabled && (
        <Tab.Screen 
          name="ChatTab" 
          component={ChatStack} 
          options={{ tabBarLabel: 'Chat' }}
        />
      )}
      <Tab.Screen 
        name="NotificationsTab" 
        component={NotificationsStack} 
        options={{ tabBarLabel: 'Notifications' }}
      />
      <Tab.Screen 
        name="ProfileTab" 
        component={ProfileStack} 
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

export default AppNavigator;
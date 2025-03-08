// src/redux/slices/themeSlice.js
// Theme state management using Redux Toolkit

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { lightTheme, darkTheme } from '../../theme/theme';

// Available theme modes
export const ThemeMode = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// Initial state
const initialState = {
  mode: ThemeMode.SYSTEM,
  isDark: false,
  theme: lightTheme,
  fontScale: 1.0,
  highContrast: false,
  reducedMotion: false,
  status: 'idle'
};

/**
 * Load theme settings from AsyncStorage
 */
export const loadThemeSettings = createAsyncThunk(
  'theme/loadThemeSettings',
  async (_, { rejectWithValue }) => {
    try {
      // Get stored settings
      const themeMode = await AsyncStorage.getItem('themeMode');
      const fontScale = await AsyncStorage.getItem('fontScale');
      const highContrast = await AsyncStorage.getItem('highContrast');
      const reducedMotion = await AsyncStorage.getItem('reducedMotion');
      
      // Get system color scheme
      const systemColorScheme = Appearance.getColorScheme();
      
      // Determine if dark mode based on settings
      const mode = themeMode || ThemeMode.SYSTEM;
      const isDark = mode === ThemeMode.DARK || 
        (mode === ThemeMode.SYSTEM && systemColorScheme === 'dark');
      
      return {
        mode,
        isDark,
        fontScale: fontScale ? parseFloat(fontScale) : 1.0,
        highContrast: highContrast === 'true',
        reducedMotion: reducedMotion === 'true'
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Save theme mode to AsyncStorage
 */
export const saveThemeMode = createAsyncThunk(
  'theme/saveThemeMode',
  async (mode, { rejectWithValue }) => {
    try {
      // Validate mode
      if (!Object.values(ThemeMode).includes(mode)) {
        throw new Error('Invalid theme mode');
      }
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('themeMode', mode);
      
      // Get system color scheme
      const systemColorScheme = Appearance.getColorScheme();
      
      // Determine if dark mode
      const isDark = mode === ThemeMode.DARK || 
        (mode === ThemeMode.SYSTEM && systemColorScheme === 'dark');
      
      return { mode, isDark };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Save accessibility settings
 */
export const saveAccessibilitySettings = createAsyncThunk(
  'theme/saveAccessibilitySettings',
  async (settings, { rejectWithValue }) => {
    try {
      const { fontScale, highContrast, reducedMotion } = settings;
      
      // Save to AsyncStorage
      if (fontScale !== undefined) {
        await AsyncStorage.setItem('fontScale', fontScale.toString());
      }
      
      if (highContrast !== undefined) {
        await AsyncStorage.setItem('highContrast', highContrast.toString());
      }
      
      if (reducedMotion !== undefined) {
        await AsyncStorage.setItem('reducedMotion', reducedMotion.toString());
      }
      
      return settings;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Create the theme slice
const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    // Toggle between light and dark mode
    toggleTheme: (state) => {
      // If in system mode, switch to light/dark
      if (state.mode === ThemeMode.SYSTEM) {
        state.mode = state.isDark ? ThemeMode.LIGHT : ThemeMode.DARK;
      } else {
        // Toggle between light and dark
        state.mode = state.mode === ThemeMode.LIGHT ? ThemeMode.DARK : ThemeMode.LIGHT;
      }
      
      // Update isDark flag
      state.isDark = state.mode === ThemeMode.DARK;
      
      // Update theme object
      state.theme = state.isDark ? darkTheme : lightTheme;
    },
    
    // Set theme based on system changes
    setSystemAppearance: (state, action) => {
      const colorScheme = action.payload;
      
      // Only update if in system mode
      if (state.mode === ThemeMode.SYSTEM) {
        state.isDark = colorScheme === 'dark';
        state.theme = state.isDark ? darkTheme : lightTheme;
      }
    },
    
    // Reset theme settings to defaults
    resetThemeSettings: (state) => {
      state.mode = ThemeMode.SYSTEM;
      state.isDark = Appearance.getColorScheme() === 'dark';
      state.theme = state.isDark ? darkTheme : lightTheme;
      state.fontScale = 1.0;
      state.highContrast = false;
      state.reducedMotion = false;
    }
  },
  extraReducers: (builder) => {
    builder
      // Load Theme Settings
      .addCase(loadThemeSettings.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadThemeSettings.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.mode = action.payload.mode;
        state.isDark = action.payload.isDark;
        state.theme = action.payload.isDark ? darkTheme : lightTheme;
        state.fontScale = action.payload.fontScale;
        state.highContrast = action.payload.highContrast;
        state.reducedMotion = action.payload.reducedMotion;
      })
      .addCase(loadThemeSettings.rejected, (state) => {
        state.status = 'failed';
        // On error, we keep default settings
      })
      
      // Save Theme Mode
      .addCase(saveThemeMode.fulfilled, (state, action) => {
        state.mode = action.payload.mode;
        state.isDark = action.payload.isDark;
        state.theme = action.payload.isDark ? darkTheme : lightTheme;
      })
      
      // Save Accessibility Settings
      .addCase(saveAccessibilitySettings.fulfilled, (state, action) => {
        const { fontScale, highContrast, reducedMotion } = action.payload;
        
        if (fontScale !== undefined) {
          state.fontScale = fontScale;
        }
        
        if (highContrast !== undefined) {
          state.highContrast = highContrast;
        }
        
        if (reducedMotion !== undefined) {
          state.reducedMotion = reducedMotion;
        }
      });
  },
});

// Export actions
export const { 
  toggleTheme, 
  setSystemAppearance, 
  resetThemeSettings 
} = themeSlice.actions;

// Export selectors
export const selectThemeMode = (state) => state.theme.mode;
export const selectIsDarkMode = (state) => state.theme.isDark;
export const selectTheme = (state) => state.theme.theme;
export const selectFontScale = (state) => state.theme.fontScale;
export const selectHighContrast = (state) => state.theme.highContrast;
export const selectReducedMotion = (state) => state.theme.reducedMotion;

// Export reducer
export default themeSlice.reducer;

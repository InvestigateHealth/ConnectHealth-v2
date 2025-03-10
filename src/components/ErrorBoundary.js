// src/components/ErrorBoundary.js
// Enhanced Error Boundary with recovery options and analytics

import React, { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AnalyticsService } from '../services/AnalyticsService';
import { useTheme } from '../theme/ThemeContext';
import { useTranslation } from 'react-i18next';

// Wrapper to use hooks in class component
const withHooks = (Component) => {
  return (props) => {
    const { theme } = useTheme();
    const { t } = useTranslation();
    return <Component {...props} theme={theme} t={t} />;
  };
};

class ErrorBoundaryClass extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to analytics
    AnalyticsService.logEvent('error_boundary_caught', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      timestamp: Date.now()
    });
    
    this.setState({ errorInfo });
    
    // Log error to console in development
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    // Log recovery attempt
    AnalyticsService.logEvent('error_boundary_reset', {
      timestamp: Date.now()
    });
  }

  render() {
    const { theme, t, children } = this.props;
    
    if (this.state.hasError) {
      return (
        <View style={[styles.container, { backgroundColor: theme?.colors?.background?.default || '#FFFFFF' }]}>
          <Text style={[styles.title, { color: theme?.colors?.error?.main || '#D32F2F' }]}>
            {t('error_boundary.title', 'Oops! Something went wrong')}
          </Text>
          
          <Text style={[styles.message, { color: theme?.colors?.text?.primary || '#000000' }]}>
            {t('error_boundary.message', 'The application encountered an unexpected error.')}
          </Text>
          
          {__DEV__ && this.state.error && (
            <View style={styles.devErrorContainer}>
              <Text style={styles.devErrorTitle}>Error Details (Dev Only):</Text>
              <Text style={styles.devErrorText}>{this.state.error.toString()}</Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme?.colors?.primary?.main || '#2196F3' }]} 
            onPress={this.resetError}>
            <Text style={styles.buttonText}>
              {t('error_boundary.try_again', 'Try Again')}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  devErrorContainer: {
    marginTop: 20,
    marginBottom: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    backgroundColor: '#F5F5F5',
    width: '100%',
  },
  devErrorTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#D32F2F',
  },
  devErrorText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
  }
});

export const ErrorBoundary = withHooks(ErrorBoundaryClass);

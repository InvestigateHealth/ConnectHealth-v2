// src/components/ErrorBoundary.js
// Error boundary component to catch unexpected errors in production

import React, { Component } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { AnalyticsService } from '../services/AnalyticsService';
import DeviceInfo from 'react-native-device-info';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      appVersion: '',
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  async componentDidMount() {
    // Get app version
    const version = `${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`;
    this.setState({ appVersion: version });
    
    // Get error count from storage
    try {
      const errorCount = await AsyncStorage.getItem('@error_count');
      if (errorCount !== null) {
        this.setState({ errorCount: parseInt(errorCount, 10) });
      }
    } catch (error) {
      console.error('Error reading error count from storage:', error);
    }
  }

  async componentDidCatch(error, errorInfo) {
    // Log the error to analytics
    AnalyticsService.logError(
      error.toString(),
      'unhandled_exception',
      {
        componentStack: errorInfo?.componentStack,
        appVersion: this.state.appVersion,
        errorCount: this.state.errorCount + 1,
      }
    );
    
    // Update error info state
    this.setState({ errorInfo });
    
    // Increment error count
    const newErrorCount = this.state.errorCount + 1;
    this.setState({ errorCount: newErrorCount });
    
    // Save error count to storage
    try {
      await AsyncStorage.setItem('@error_count', newErrorCount.toString());
      
      // Also log the error details for debugging
      const errorLog = await AsyncStorage.getItem('@error_log') || '[]';
      const errorLogs = JSON.parse(errorLog);
      
      errorLogs.push({
        timestamp: new Date().toISOString(),
        error: error.toString(),
        componentStack: errorInfo?.componentStack,
        appVersion: this.state.appVersion,
      });
      
      // Keep only the last 10 errors
      const recentErrors = errorLogs.slice(-10);
      await AsyncStorage.setItem('@error_log', JSON.stringify(recentErrors));
    } catch (storageError) {
      console.error('Error saving error details to storage:', storageError);
    }
  }

  resetError = async () => {
    // Reset the error state
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    // Reset the component tree by force updating
    this.forceUpdate();
    
    // Clear error logs in extreme cases
    if (this.state.errorCount > 10) {
      try {
        await AsyncStorage.removeItem('@error_log');
        await AsyncStorage.setItem('@error_count', '0');
        this.setState({ errorCount: 0 });
      } catch (error) {
        console.error('Error clearing error logs:', error);
      }
    }
  };

  resetApp = async () => {
    // Reset the app by clearing cache and storage
    try {
      // Keep user authentication but clear caches
      const keys = await AsyncStorage.getAllKeys();
      const keysToRemove = keys.filter(key => !key.startsWith('@auth_'));
      await AsyncStorage.multiRemove(keysToRemove);
      
      // Reset error count
      await AsyncStorage.setItem('@error_count', '0');
      this.setState({ errorCount: 0 });
      
      // Force app reload
      this.resetError();
    } catch (error) {
      console.error('Error resetting app:', error);
    }
  };

  render() {
    if (this.state.hasError) {
      // If we're in development, show more detailed error
      if (__DEV__) {
        return (
          <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <View style={styles.errorHeader}>
                <Icon name="alert-circle" size={60} color="#E53935" />
                <Text style={styles.errorTitle}>Something went wrong</Text>
              </View>
              
              <View style={styles.errorDetails}>
                <Text style={styles.errorHeading}>Error:</Text>
                <Text style={styles.errorText}>{this.state.error?.toString()}</Text>
                
                <Text style={styles.errorHeading}>Component Stack:</Text>
                <ScrollView style={styles.stackContainer}>
                  <Text style={styles.stackText}>
                    {this.state.errorInfo?.componentStack}
                  </Text>
                </ScrollView>
              </View>
              
              <View style={styles.actionsContainer}>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={this.resetError}
                >
                  <Text style={styles.actionButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        );
      }
      
      // In production, show a user-friendly error
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Icon name="alert-circle" size={80} color="#E53935" />
            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
            <Text style={styles.errorMessage}>
              We're sorry, but the app has encountered an unexpected error.
            </Text>
            
            <View style={styles.actionsContainer}>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={this.resetError}
              >
                <Text style={styles.actionButtonText}>Try Again</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.resetButton]} 
                onPress={this.resetApp}
              >
                <Text style={styles.actionButtonText}>Reset App</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.versionText}>
              Version: {this.state.appVersion}
            </Text>
            
            <Text style={styles.errorCode}>
              Error Code: {Math.abs(
                this.state.error?.toString().split('').reduce(
                  (acc, char) => acc + char.charCodeAt(0), 0
                ) || 0
              ) % 1000}
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#263238',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#546E7A',
    textAlign: 'center',
    marginBottom: 30,
  },
  errorDetails: {
    backgroundColor: '#ECEFF1',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  errorHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#546E7A',
    marginBottom: 15,
  },
  stackContainer: {
    maxHeight: 200,
    backgroundColor: '#CFD8DC',
    borderRadius: 4,
    padding: 8,
  },
  stackText: {
    fontSize: 12,
    color: '#37474F',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    margin: 10,
  },
  resetButton: {
    backgroundColor: '#FF9800',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    fontSize: 12,
    color: '#78909C',
    marginTop: 30,
  },
  errorCode: {
    fontSize: 10,
    color: '#90A4AE',
    marginTop: 5,
  },
});

export { ErrorBoundary };

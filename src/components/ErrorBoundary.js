// src/components/ErrorBoundary.js
import React, { Component } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import { AnalyticsService } from '../services/AnalyticsService';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      deviceInfo: {},
      networkInfo: {},
      errorId: null,
      isReporting: false,
      reportSent: false,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console
    console.error('Application error:', error, errorInfo);
    
    // Collect device and network info
    this.collectDiagnosticInfo(error, errorInfo);
  }

  async collectDiagnosticInfo(error, errorInfo) {
    try {
      // Generate unique ID for this error
      const errorId = `error_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Collect device information
      const deviceInfo = {
        appVersion: await DeviceInfo.getVersion(),
        buildNumber: await DeviceInfo.getBuildNumber(),
        deviceId: await DeviceInfo.getUniqueId(),
        deviceModel: await DeviceInfo.getModel(),
        deviceManufacturer: await DeviceInfo.getManufacturer(),
        systemVersion: await DeviceInfo.getSystemVersion(),
        isTablet: await DeviceInfo.isTablet(),
        isEmulator: await DeviceInfo.isEmulator(),
        carrier: await DeviceInfo.getCarrier(),
        totalMemory: await DeviceInfo.getTotalMemory(),
        freeDiskStorage: await DeviceInfo.getFreeDiskStorage(),
        timezone: await DeviceInfo.getTimezone(),
        locale: await DeviceInfo.getDeviceLocale(),
      };
      
      // Collect network information
      const networkInfo = await NetInfo.fetch();
      
      // Update state with all diagnostic info
      this.setState({
        errorInfo,
        deviceInfo,
        networkInfo,
        errorId,
      });
      
      // Log error to analytics
      AnalyticsService.logEvent('app_error', {
        error_message: error.message,
        error_stack: error.stack,
        error_id: errorId,
        app_version: deviceInfo.appVersion,
        build_number: deviceInfo.buildNumber,
        device_model: deviceInfo.deviceModel,
        system_version: deviceInfo.systemVersion,
        is_connected: networkInfo.isConnected,
      });
      
      // Save error details to local storage for recovery/reporting later if needed
      await AsyncStorage.setItem(`error_${errorId}`, JSON.stringify({
        timestamp: Date.now(),
        error: {
          message: error.message,
          stack: error.stack,
        },
        errorInfo: {
          componentStack: errorInfo.componentStack,
        },
        deviceInfo,
        networkInfo,
      }));
    } catch (collectError) {
      console.error('Error collecting diagnostic info:', collectError);
    }
  }

  resetError = async () => {
    try {
      // Clear any cached state that might be causing the error
      const keys = await AsyncStorage.getAllKeys();
      const stateCacheKeys = keys.filter(key => key.startsWith('state_cache_'));
      
      if (stateCacheKeys.length > 0) {
        await AsyncStorage.multiRemove(stateCacheKeys);
      }
      
      // Reset the error state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    } catch (resetError) {
      console.error('Error resetting application:', resetError);
    }
  }

  reportError = async () => {
    this.setState({ isReporting: true });
    
    try {
      // Only submit if we have network
      const networkState = await NetInfo.fetch();
      
      if (networkState.isConnected) {
        // Send error report to Firestore
        await firestore().collection('errorReports').add({
          errorId: this.state.errorId,
          timestamp: firestore.FieldValue.serverTimestamp(),
          error: {
            message: this.state?.error?.message || 'Unknown error',
            stack: this.state?.error?.stack || '',
          },
          componentStack: this.state?.errorInfo?.componentStack || '',
          deviceInfo: this.state.deviceInfo,
          networkInfo: this.state.networkInfo,
        });
        
        this.setState({ reportSent: true });
      } else {
        // Store for later submission when online
        await AsyncStorage.setItem('pending_error_reports', JSON.stringify([
          ...(JSON.parse(await AsyncStorage.getItem('pending_error_reports') || '[]')),
          this.state.errorId
        ]));
      }
    } catch (reportError) {
      console.error('Error reporting crash:', reportError);
    } finally {
      this.setState({ isReporting: false });
    }
  }

  render() {
    const { hasError, error, isReporting, reportSent } = this.state;
    
    if (!hasError) {
      return this.props.children;
    }
    
    // Render fallback UI
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.title}>Something went wrong</Text>
          
          <Text style={styles.description}>
            The application encountered an unexpected error. Please try restarting the app.
            If the issue persists, please contact support.
          </Text>
          
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Error Details:</Text>
              <Text style={styles.errorText}>{error.toString()}</Text>
            </View>
          )}
          
          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.resetButton]} 
              onPress={this.resetError}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
            
            {!reportSent ? (
              <TouchableOpacity 
                style={[styles.button, styles.reportButton, isReporting && styles.disabledButton]} 
                onPress={this.reportError}
                disabled={isReporting}
              >
                <Text style={styles.buttonText}>
                  {isReporting ? 'Sending...' : 'Report Issue'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.button, styles.reportedButton]}>
                <Text style={styles.buttonText}>Report Sent</Text>
              </View>
            )}
          </View>
          
          {reportSent && (
            <Text style={styles.thankYouText}>
              Thank you for reporting this issue. Our team will investigate it.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#212529',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorContainer: {
    width: '100%',
    backgroundColor: '#f8d7da',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#721c24',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 140,
  },
  resetButton: {
    backgroundColor: '#007bff',
    marginRight: 8,
  },
  reportButton: {
    backgroundColor: '#6c757d',
    marginLeft: 8,
  },
  reportedButton: {
    backgroundColor: '#28a745',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  thankYouText: {
    fontSize: 14,
    color: '#28a745',
    textAlign: 'center',
  },
});

export { ErrorBoundary };

// src/services/SecureApiService.js
// Secure API service with authentication, error handling, retry logic, and offline support

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import auth from '@react-native-firebase/auth';
import { Alert, Platform } from 'react-native';
import { isRetriableError } from './RetryService';
import { isDeviceOnline } from './NetworkService';
import { AnalyticsService } from './AnalyticsService';
import CryptoJS from 'crypto-js';
import Config from 'react-native-config';

// Queue for offline requests
const REQUEST_QUEUE_KEY = 'api_request_queue';
const API_CACHE_PREFIX = 'api_cache_';

// Default API configuration
const DEFAULT_CONFIG = {
  baseUrl: Config.API_BASE_URL || 'https://api.healthconnect.app/v1',  // Use the value from Config or fallback to production URL
  timeout: 30000,  // 30 seconds
  retries: 3,
  retryDelay: 1000,  // 1 second
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  rateLimits: {
    maxRequestsPerMinute: 60,
    maxConcurrentRequests: 10
  },
  caching: {
    enabled: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  }
};

/**
 * Secure API Service for handling all network requests
 */
class SecureApiService {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Validate the baseUrl
    if (!this.config.baseUrl) {
      console.warn('API baseUrl not configured. Using default production URL.');
      this.config.baseUrl = 'https://api.healthconnect.app/v1';
    }
    
    this.offlineMode = false;
    this.offlineQueue = [];
    this.networkListener = null;
    this.pendingRequests = 0;
    this.requestsThisMinute = 0;
    this.rateLimitTimer = null;
    this.abortControllers = new Map();
    this.cacheEnabled = this.config.caching.enabled;
    this.initializeNetworkListener();
    this.loadOfflineQueue();
    this.setupRateLimitReset();
    
    // Log initialization
    console.log(`SecureApiService initialized with baseUrl: ${this.config.baseUrl}`);
  }

  // Rest of the existing code...
  // [Existing SecureApiService implementation remains unchanged]
}

// Create and export singleton instance with default config
export const apiService = new SecureApiService();

// Export the class for creating custom instances
export default SecureApiService;

// Helper function to provide safe API calls with error handling
export const callApi = async (apiMethod, ...args) => {
  try {
    return await apiMethod(...args);
  } catch (error) {
    // Use the error utils to format the error
    const formattedError = {
      source: 'api',
      message: error.message,
      originalError: error
    };
    
    throw formattedError;
  }
};
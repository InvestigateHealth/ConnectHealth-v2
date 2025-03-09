// src/services/SecureApiService.js
// Secure API service with authentication, error handling, retry logic, and offline support

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import auth from '@react-native-firebase/auth';
import { handleError } from '../utils/errorUtils';
import { isRetriableError } from './RetryService';

// Queue for offline requests
const REQUEST_QUEUE_KEY = 'api_request_queue';

// Default API configuration
const DEFAULT_CONFIG = {
  baseUrl: '',  // Set your API base URL here
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
  }
};

/**
 * Secure API Service for handling all network requests
 */
class SecureApiService {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.offlineMode = false;
    this.offlineQueue = [];
    this.networkListener = null;
    this.pendingRequests = 0;
    this.requestsThisMinute = 0;
    this.rateLimitTimer = null;
    this.abortControllers = new Map();
    this.initializeNetworkListener();
    this.loadOfflineQueue();
    this.setupRateLimitReset();
  }

  /**
   * Initialize network state listener
   */
  initializeNetworkListener() {
    this.networkListener = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected && state.isInternetReachable;
      const wasOffline = this.offlineMode;
      this.offlineMode = !isConnected;

      // If we're back online and we were offline before, process the queue
      if (isConnected && wasOffline) {
        this.processOfflineQueue();
      }
    });
  }

  /**
   * Set up rate limit reset timer
   */
  setupRateLimitReset() {
    // Reset request count every minute
    this.rateLimitTimer = setInterval(() => {
      this.requestsThisMinute = 0;
    }, 60000);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.networkListener) {
      this.networkListener();
      this.networkListener = null;
    }

    if (this.rateLimitTimer) {
      clearInterval(this.rateLimitTimer);
      this.rateLimitTimer = null;
    }

    // Cancel any pending requests
    this.abortControllers.forEach((controller) => {
      try {
        controller.abort();
      } catch (error) {
        console.error('Error aborting request:', error);
      }
    });
    this.abortControllers.clear();
  }

  /**
   * Load queued requests from storage
   */
  async loadOfflineQueue() {
    try {
      const queueJson = await AsyncStorage.getItem(REQUEST_QUEUE_KEY);
      if (queueJson) {
        this.offlineQueue = JSON.parse(queueJson);
      }
    } catch (error) {
      console.error('Error loading offline request queue:', error);
    }
  }

  /**
   * Save queue to storage
   */
  async saveOfflineQueue() {
    try {
      await AsyncStorage.setItem(REQUEST_QUEUE_KEY, JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Error saving offline request queue:', error);
    }
  }

  /**
   * Process offline request queue
   */
  async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return;

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    await this.saveOfflineQueue();

    for (const request of queue) {
      try {
        // Execute the request without queueing on failure
        await this.request(
          request.endpoint,
          request.options,
          { ...request.config, queueIfOffline: false }
        );
      } catch (error) {
        console.error('Error processing offline request:', error);
      }
    }
  }

  /**
   * Add request to offline queue
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @param {Object} config - Request configuration
   */
  async addToOfflineQueue(endpoint, options, config) {
    // Add timestamp and unique ID
    const queueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      endpoint,
      options,
      config,
      timestamp: Date.now()
    };

    this.offlineQueue.push(queueItem);
    await this.saveOfflineQueue();
  }

  /**
   * Get authentication token
   * 
   * @returns {Promise<string>} Authentication token
   */
  async getAuthToken() {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      return await currentUser.getIdToken(true);
    } catch (error) {
      console.error('Error getting auth token:', error);
      throw error;
    }
  }

  /**
   * Prepare request headers with authentication
   * 
   * @param {boolean} requiresAuth - Whether the request requires authentication
   * @param {Object} customHeaders - Custom headers to include
   * @returns {Promise<Object>} Headers object
   */
  async prepareHeaders(requiresAuth = true, customHeaders = {}) {
    const headers = { ...this.config.headers, ...customHeaders };

    // Add security headers
    headers['X-Requested-With'] = 'XMLHttpRequest';
    
    if (requiresAuth) {
      try {
        const token = await this.getAuthToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error('Error preparing authenticated headers:', error);
        throw error;
      }
    }

    return headers;
  }

  /**
   * Check if we should throttle requests based on rate limits
   * 
   * @returns {boolean} Whether to throttle requests
   */
  shouldThrottleRequests() {
    const { maxRequestsPerMinute, maxConcurrentRequests } = this.config.rateLimits;
    
    // Check if we've exceeded the rate limit
    if (this.requestsThisMinute >= maxRequestsPerMinute) {
      console.warn('Rate limit exceeded, throttling requests');
      return true;
    }
    
    // Check if we've exceeded concurrent requests limit
    if (this.pendingRequests >= maxConcurrentRequests) {
      console.warn('Concurrent requests limit exceeded, throttling requests');
      return true;
    }
    
    return false;
  }

  /**
   * Make API request with retry logic and offline support
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @param {Object} config - Request configuration
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}, config = {}) {
    const {
      requiresAuth = true,
      retries = this.config.retries,
      retryDelay = this.config.retryDelay,
      timeout = this.config.timeout,
      queueIfOffline = true,
      priority = 'normal', // 'high', 'normal', 'low'
    } = config;

    // Check if we should throttle requests
    if (this.shouldThrottleRequests() && priority !== 'high') {
      const waitTime = priority === 'low' ? 5000 : 2000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Check if we're offline
    const networkState = await NetInfo.fetch();
    const isConnected = networkState.isConnected && networkState.isInternetReachable;

    if (!isConnected) {
      this.offlineMode = true;
      
      // If configured to queue offline requests
      if (queueIfOffline && (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE')) {
        await this.addToOfflineQueue(endpoint, options, config);
        return { queued: true, message: 'Request queued for when connection is restored' };
      }
      
      throw new Error('No internet connection available');
    }

    // Prepare the request URL
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${this.config.baseUrl}/${endpoint.startsWith('/') ? endpoint.slice(1) : endpoint}`;

    // Validate URL
    if (!this.isValidUrl(url)) {
      throw new Error('Invalid URL');
    }

    // Prepare headers with auth token if needed
    const headers = await this.prepareHeaders(requiresAuth, options.headers);

    // Create abort controller for this request
    const controller = new AbortController();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.abortControllers.set(requestId, controller);

    // Prepare the request
    const requestOptions = {
      ...options,
      headers,
      signal: controller.signal,
    };

    // Create timeout for abort controller
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    // Track request count and concurrent requests
    this.requestsThisMinute++;
    this.pendingRequests++;

    // Retry logic with exponential backoff
    let attempt = 0;
    let error;

    try {
      while (attempt <= retries) {
        try {
          const response = await fetch(url, requestOptions);
          
          // Check for HTTP error responses
          if (!response.ok) {
            const errorData = await this.parseResponseError(response);
            throw new Error(
              errorData.message || `Request failed with status ${response.status}`
            );
          }
          
          // Parse and return successful response
          const contentType = response.headers.get('content-type');
          let data;
          
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }
          
          // Request succeeded, clean up and return data
          clearTimeout(timeoutId);
          this.abortControllers.delete(requestId);
          this.pendingRequests--;
          
          return data;
        } catch (err) {
          error = err;
          
          // If aborted due to timeout, throw immediately
          if (err.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
          }
          
          // Don't retry if it's a specific error type
          if (
            (err.response && err.response.status === 401) || // Unauthorized
            (err.response && err.response.status === 403) || // Forbidden
            (err.response && err.response.status === 404)    // Not found
          ) {
            break;
          }
          
          // Last attempt, don't delay
          if (attempt === retries) {
            break;
          }
          
          // Check if error is retriable
          if (!isRetriableError(err)) {
            break;
          }
          
          // Delay before next retry with exponential backoff
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          attempt++;
        }
      }
      
      // If we get here, all retries failed
      throw error;
    } finally {
      // Always clean up
      clearTimeout(timeoutId);
      this.abortControllers.delete(requestId);
      this.pendingRequests--;
    }
  }

  /**
   * Parse an error response
   * 
   * @param {Response} response - Fetch response object
   * @returns {Promise<Object>} Parsed error data
   */
  async parseResponseError(response) {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return { message: await response.text() };
    } catch (error) {
      return { message: `HTTP Error ${response.status}` };
    }
  }

  /**
   * Validate URL
   * 
   * @param {string} url - URL to validate
   * @returns {boolean} Whether URL is valid
   */
  isValidUrl(url) {
    try {
      const parsedUrl = new URL(url);
      // Only allow http and https protocols
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  /**
   * GET request
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @param {Object} config - Request configuration
   * @returns {Promise<any>} Response data
   */
  async get(endpoint, params = {}, config = {}) {
    // Add query parameters to URL
    const url = this.buildUrlWithParams(endpoint, params);
    
    return this.request(url, { method: 'GET' }, config);
  }

  /**
   * POST request
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} config - Request configuration
   * @returns {Promise<any>} Response data
   */
  async post(endpoint, data = {}, config = {}) {
    return this.request(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      config
    );
  }

  /**
   * PUT request
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} config - Request configuration
   * @returns {Promise<any>} Response data
   */
  async put(endpoint, data = {}, config = {}) {
    return this.request(
      endpoint,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      config
    );
  }

  /**
   * PATCH request
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} config - Request configuration
   * @returns {Promise<any>} Response data
   */
  async patch(endpoint, data = {}, config = {}) {
    return this.request(
      endpoint,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      config
    );
  }

  /**
   * DELETE request
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} config - Request configuration
   * @returns {Promise<any>} Response data
   */
  async delete(endpoint, config = {}) {
    return this.request(
      endpoint,
      {
        method: 'DELETE',
      },
      config
    );
  }

  /**
   * Upload file
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} file - File object with uri, type, and name
   * @param {Object} additionalData - Additional form data
   * @param {Object} config - Request configuration
   * @returns {Promise<any>} Response data
   */
  async uploadFile(endpoint, file, additionalData = {}, config = {}) {
    const formData = new FormData();
    
    // Add the file
    formData.append('file', {
      uri: file.uri,
      type: file.type || 'application/octet-stream',
      name: file.name || 'file',
    });
    
    // Add any additional data
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });
    
    return this.request(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      },
      config
    );
  }

  /**
   * Build URL with query parameters
   * 
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {string} URL with query parameters
   */
  buildUrlWithParams(endpoint, params) {
    if (!params || Object.keys(params).length === 0) {
      return endpoint;
    }
    
    const queryString = Object.keys(params)
      .map(key => {
        const value = params[key];
        if (value !== undefined && value !== null) {
          return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('&');
    
    if (!queryString) {
      return endpoint;
    }
    
    return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryString}`;
  }

  /**
   * Check if there are pending offline requests
   * 
   * @returns {Promise<boolean>} Whether there are pending requests
   */
  async hasPendingRequests() {
    await this.loadOfflineQueue();
    return this.offlineQueue.length > 0;
  }

  /**
   * Clear offline request queue
   * 
   * @returns {Promise<void>}
   */
  async clearOfflineQueue() {
    this.offlineQueue = [];
    await this.saveOfflineQueue();
  }

  /**
   * Get the number of pending offline requests
   * 
   * @returns {Promise<number>} Count of pending requests
   */
  async getPendingRequestCount() {
    await this.loadOfflineQueue();
    return this.offlineQueue.length;
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests() {
    this.abortControllers.forEach((controller) => {
      try {
        controller.abort();
      } catch (error) {
        console.error('Error aborting request:', error);
      }
    });
    this.abortControllers.clear();
    this.pendingRequests = 0;
  }
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
    throw handleError(error, 'api', true);
  }
};

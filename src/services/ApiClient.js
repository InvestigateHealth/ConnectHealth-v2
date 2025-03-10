// src/services/ApiClient.js
// Enhanced API client with retry logic, caching, and better error handling

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Config from 'react-native-config';
import { AnalyticsService } from './AnalyticsService';
import { initializeCertificatePinning } from '../utils/certificatePinning';

// Configuration
const API_TIMEOUT = parseInt(Config.API_TIMEOUT_SECONDS || '10', 10) * 1000;
const MAX_RETRIES = parseInt(Config.MAX_RETRIES || '3', 10);
const CACHE_EXPIRY = parseInt(Config.CACHE_EXPIRY_HOURS || '24', 10) * 60 * 60 * 1000;

class ApiClient {
  constructor() {
    this.baseUrl = Config.API_BASE_URL || 'https://api.healthconnect.app/v1';
    this.authToken = null;
    this.refreshToken = null;
    this.initialized = false;
    this.pendingRequests = [];
    this.isRefreshing = false;
  }

  /**
   * Initialize the API client
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
    
    try {
      // Initialize certificate pinning
      initializeCertificatePinning();
      
      // Try to restore auth tokens from secure storage
      await this.restoreAuthTokens();
      
      this.initialized = true;
      
      // Process any pending requests
      this.processPendingRequests();
      
      AnalyticsService.logEvent('api_client_initialized', {
        success: true,
        hasAuthToken: !!this.authToken,
      });
      
      return true;
    } catch (error) {
      console.error('Error initializing API client:', error);
      AnalyticsService.logError(error, { context: 'initialize_api_client' });
      
      // Still mark as initialized to avoid repeated failures
      this.initialized = true;
      
      return false;
    }
  }
  
  /**
   * Restore authentication tokens from secure storage
   * @private
   */
  async restoreAuthTokens() {
    try {
      // In a real app, you would use a more secure storage like react-native-keychain
      // For this example, we're using AsyncStorage
      const authToken = await AsyncStorage.getItem('authToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      if (authToken) {
        this.authToken = authToken;
      }
      
      if (refreshToken) {
        this.refreshToken = refreshToken;
      }
    } catch (error) {
      console.error('Error restoring auth tokens:', error);
      AnalyticsService.logError(error, { context: 'restore_auth_tokens' });
    }
  }
  
  /**
   * Set authentication tokens
   * @param {object} tokens Object containing authToken and refreshToken
   */
  async setAuthTokens(tokens) {
    try {
      if (!tokens) {
        return;
      }
      
      const { authToken, refreshToken } = tokens;
      
      if (authToken) {
        this.authToken = authToken;
        await AsyncStorage.setItem('authToken', authToken);
      }
      
      if (refreshToken) {
        this.refreshToken = refreshToken;
        await AsyncStorage.setItem('refreshToken', refreshToken);
      }
    } catch (error) {
      console.error('Error saving auth tokens:', error);
      AnalyticsService.logError(error, { context: 'set_auth_tokens' });
    }
  }
  
  /**
   * Clear authentication tokens
   */
  async clearAuthTokens() {
    try {
      this.authToken = null;
      this.refreshToken = null;
      
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('refreshToken');
    } catch (error) {
      console.error('Error clearing auth tokens:', error);
      AnalyticsService.logError(error, { context: 'clear_auth_tokens' });
    }
  }
  
  /**
   * Process any pending requests
   * @private
   */
  processPendingRequests() {
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    
    requests.forEach(({ request, resolve, reject }) => {
      this.request(request)
        .then(resolve)
        .catch(reject);
    });
  }
  
  /**
   * Check if the device is online
   * @private
   * @returns {Promise<boolean>} Whether the device is online
   */
  async isOnline() {
    try {
      const netInfo = await NetInfo.fetch();
      return netInfo.isConnected && netInfo.isInternetReachable;
    } catch (error) {
      console.error('Error checking online status:', error);
      return false;
    }
  }
  
  /**
   * Generate a cache key for a request
   * @private
   * @param {object} request Request object
   * @returns {string} Cache key
   */
  getCacheKey(request) {
    const { method, endpoint, params } = request;
    
    // Only cache GET requests
    if (method.toUpperCase() !== 'GET') {
      return null;
    }
    
    // Generate a key based on the request details
    return `api_cache_${endpoint}_${JSON.stringify(params || {})}`;
  }
  
  /**
   * Store a response in the cache
   * @private
   * @param {string} key Cache key
   * @param {object} response Response to cache
   */
  async cacheResponse(key, response) {
    if (!key) {
      return;
    }
    
    try {
      const cacheData = {
        data: response,
        timestamp: Date.now(),
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching response:', error);
    }
  }
  
  /**
   * Get a cached response
   * @private
   * @param {string} key Cache key
   * @returns {object|null} Cached response or null if not found or expired
   */
  async getCachedResponse(key) {
    if (!key) {
      return null;
    }
    
    try {
      const cachedData = await AsyncStorage.getItem(key);
      
      if (!cachedData) {
        return null;
      }
      
      const { data, timestamp } = JSON.parse(cachedData);
      
      // Check if cache is expired
      if (Date.now() - timestamp > CACHE_EXPIRY) {
        // Cache expired, remove it
        await AsyncStorage.removeItem(key);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error getting cached response:', error);
      return null;
    }
  }
  
  /**
   * Execute an API request with retries
   * @private
   * @param {object} requestOptions Request options
   * @param {number} retryCount Current retry count
   * @returns {Promise<object>} API response
   */
  async executeRequest(requestOptions, retryCount = 0) {
    const { url, options, cacheKey } = requestOptions;
    
    try {
      // Start performance tracking
      const perfTracker = AnalyticsService.startTrackingPerformance(`api_${options.method}_${url.replace(this.baseUrl, '')}`);
      
      // Set timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
      
      // Add abort signal to options
      options.signal = controller.signal;
      
      // Execute the request
      const response = await fetch(url, options);
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Stop performance tracking
      AnalyticsService.stopTrackingPerformance(perfTracker);
      
      // Parse response
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      // Handle different response statuses
      if (response.ok) {
        // Cache successful GET responses
        if (cacheKey) {
          this.cacheResponse(cacheKey, data);
        }
        
        // Log success
        AnalyticsService.logEvent('api_request_success', {
          url: url.replace(this.baseUrl, ''),
          method: options.method,
          status: response.status,
        });
        
        return data;
      } else {
        // Handle specific error cases
        switch (response.status) {
          case 401:
            // Unauthorized - token might be expired
            if (this.refreshToken && !options.isRefreshRequest) {
              // Try to refresh the token
              const refreshed = await this.refreshAuthToken();
              
              if (refreshed) {
                // Retry the request with the new token
                const newOptions = { ...options };
                newOptions.headers.Authorization = `Bearer ${this.authToken}`;
                
                return this.executeRequest({ url, options: newOptions, cacheKey }, 0);
              }
            }
            
            // If we can't refresh the token, throw an auth error
            throw {
              status: 401,
              message: 'Authentication failed. Please log in again.',
              isAuthError: true,
            };
            
          case 403:
            // Forbidden
            throw {
              status: 403,
              message: 'You don\'t have permission to access this resource.',
              data,
            };
            
          case 404:
            // Not found
            throw {
              status: 404,
              message: 'The requested resource was not found.',
              data,
            };
            
          case 429:
            // Too many requests - implement exponential backoff
            if (retryCount < MAX_RETRIES) {
              const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
              
              // Wait and retry
              await new Promise(resolve => setTimeout(resolve, waitTime));
              
              return this.executeRequest(requestOptions, retryCount + 1);
            }
            
            // If we've reached max retries, throw an error
            throw {
              status: 429,
              message: 'Too many requests. Please try again later.',
              data,
            };
            
          default:
            // Other errors
            throw {
              status: response.status,
              message: data.message || 'An error occurred during the request.',
              data,
            };
        }
      }
    } catch (error) {
      // Handle abort/timeout
      if (error.name === 'AbortError') {
        // Log timeout
        AnalyticsService.logEvent('api_request_timeout', {
          url: url.replace(this.baseUrl, ''),
          method: options.method,
          retryCount,
        });
        
        // Retry on timeout if we haven't reached max retries
        if (retryCount < MAX_RETRIES) {
          return this.executeRequest(requestOptions, retryCount + 1);
        }
        
        throw {
          status: 0,
          message: 'Request timed out. Please try again.',
          isTimeout: true,
        };
      }
      
      // Handle network errors
      if (error instanceof TypeError && error.message === 'Network request failed') {
        // Log network error
        AnalyticsService.logEvent('api_network_error', {
          url: url.replace(this.baseUrl, ''),
          method: options.method,
          retryCount,
        });
        
        // Retry on network error if we haven't reached max retries
        if (retryCount < MAX_RETRIES) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          return this.executeRequest(requestOptions, retryCount + 1);
        }
        
        throw {
          status: 0,
          message: 'Network error. Please check your connection.',
          isNetworkError: true,
        };
      }
      
      // Log other errors
      AnalyticsService.logEvent('api_request_error', {
        url: url.replace(this.baseUrl, ''),
        method: options.method,
        status: error.status || 0,
        message: error.message,
        retryCount,
      });
      
      // Re-throw the error
      throw error;
    }
  }
  
  /**
   * Refresh the authentication token
   * @private
   * @returns {Promise<boolean>} Whether the token was refreshed successfully
   */
  async refreshAuthToken() {
    // Prevent multiple refresh attempts
    if (this.isRefreshing) {
      // Wait for the current refresh to complete
      return new Promise((resolve) => {
        const checkRefresh = setInterval(() => {
          if (!this.isRefreshing) {
            clearInterval(checkRefresh);
            resolve(!!this.authToken);
          }
        }, 100);
      });
    }
    
    this.isRefreshing = true;
    
    try {
      // Make a request to refresh the token
      const response = await this.request({
        method: 'POST',
        endpoint: '/auth/refresh',
        body: { refreshToken: this.refreshToken },
        isRefreshRequest: true,
      });
      
      if (response && response.token) {
        // Update tokens
        await this.setAuthTokens({
          authToken: response.token,
          refreshToken: response.refreshToken || this.refreshToken,
        });
        
        this.isRefreshing = false;
        return true;
      }
      
      // If refresh failed, clear tokens
      await this.clearAuthTokens();
      this.isRefreshing = false;
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      AnalyticsService.logError(error, { context: 'refresh_auth_token' });
      
      // Clear tokens on error
      await this.clearAuthTokens();
      this.isRefreshing = false;
      return false;
    }
  }
  
  /**
   * Make an API request
   * @param {object} request Request configuration
   * @returns {Promise<object>} API response
   */
  async request(request) {
    // Make sure the client is initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    const {
      method = 'GET',
      endpoint,
      params,
      body,
      headers = {},
      useCache = true,
      forceNetwork = false,
      isRefreshRequest = false,
    } = request;
    
    // Check if we can use cached data
    const cacheKey = useCache ? this.getCacheKey(request) : null;
    
    if (useCache && !forceNetwork && method.toUpperCase() === 'GET') {
      const cachedData = await this.getCachedResponse(cacheKey);
      
      if (cachedData) {
        // Log cache hit
        AnalyticsService.logEvent('api_cache_hit', {
          endpoint,
          method,
        });
        
        return cachedData;
      }
    }
    
    // Check if we're online
    const online = await this.isOnline();
    
    if (!online) {
      // If we have cached data, return it even if forced network
      if (useCache) {
        const cachedData = await this.getCachedResponse(cacheKey);
        
        if (cachedData) {
          // Log offline cache use
          AnalyticsService.logEvent('api_offline_cache_use', {
            endpoint,
            method,
          });
          
          return cachedData;
        }
      }
      
      // No cached data and offline
      throw {
        status: 0,
        message: 'You are offline. Please check your connection.',
        isOfflineError: true,
      };
    }
    
    // Prepare URL with query parameters
    let url = `${this.baseUrl}${endpoint}`;
    
    if (params && Object.keys(params).length > 0) {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
      
      const queryString = queryParams.toString();
      
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    
    // Prepare request options
    const options = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers,
      },
      isRefreshRequest,
    };
    
    // Add auth token if available (except for refresh requests which use the refresh token)
    if (this.authToken && !isRefreshRequest) {
      options.headers.Authorization = `Bearer ${this.authToken}`;
    }
    
    // Add request body for non-GET requests
    if (body && method.toUpperCase() !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    // Log request
    AnalyticsService.logEvent('api_request', {
      url: url.replace(this.baseUrl, ''),
      method: options.method,
    });
    
    // Execute the request
    return this.executeRequest({ url, options, cacheKey });
  }
  
  /**
   * Make a GET request
   * @param {string} endpoint API endpoint
   * @param {object} params Query parameters
   * @param {object} options Additional options
   * @returns {Promise<object>} API response
   */
  async get(endpoint, params = {}, options = {}) {
    return this.request({
      method: 'GET',
      endpoint,
      params,
      ...options,
    });
  }
  
  /**
   * Make a POST request
   * @param {string} endpoint API endpoint
   * @param {object} body Request body
   * @param {object} options Additional options
   * @returns {Promise<object>} API response
   */
  async post(endpoint, body = {}, options = {}) {
    return this.request({
      method: 'POST',
      endpoint,
      body,
      useCache: false,
      ...options,
    });
  }
  
  /**
   * Make a PUT request
   * @param {string} endpoint API endpoint
   * @param {object} body Request body
   * @param {object} options Additional options
   * @returns {Promise<object>} API response
   */
  async put(endpoint, body = {}, options = {}) {
    return this.request({
      method: 'PUT',
      endpoint,
      body,
      useCache: false,
      ...options,
    });
  }
  
  /**
   * Make a DELETE request
   * @param {string} endpoint API endpoint
   * @param {object} params Query parameters
   * @param {object} options Additional options
   * @returns {Promise<object>} API response
   */
  async delete(endpoint, params = {}, options = {}) {
    return this.request({
      method: 'DELETE',
      endpoint,
      params,
      useCache: false,
      ...options,
    });
  }
  
  /**
   * Upload a file
   * @param {string} endpoint API endpoint
   * @param {object} file File object
   * @param {string} fileFieldName Name of the file field
   * @param {object} additionalFields Additional form fields
   * @param {function} progressCallback Callback for upload progress
   * @returns {Promise<object>} API response
   */
  async uploadFile(endpoint, file, fileFieldName = 'file', additionalFields = {}, progressCallback = null) {
    try {
      // Make sure the client is initialized
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Check if we're online
      const online = await this.isOnline();
      
      if (!online) {
        throw {
          status: 0,
          message: 'You are offline. Please check your connection.',
          isOfflineError: true,
        };
      }
      
      // Create form data
      const formData = new FormData();
      
      // Add the file
      formData.append(fileFieldName, {
        uri: file.uri,
        name: file.name || 'file',
        type: file.type || 'application/octet-stream',
      });
      
      // Add additional fields
      Object.entries(additionalFields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      
      // Prepare URL
      const url = `${this.baseUrl}${endpoint}`;
      
      // Prepare request options
      const options = {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          // Don't set Content-Type, it will be set automatically with the correct boundary
        },
        body: formData,
      };
      
      // Add auth token if available
      if (this.authToken) {
        options.headers.Authorization = `Bearer ${this.authToken}`;
      }
      
      // TODO: Implement progress tracking in a real application
      // This would require a native module or another approach
      
      // Execute the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT * 2); // Longer timeout for uploads
      
      options.signal = controller.signal;
      
      try {
        // Log the upload attempt
        AnalyticsService.logEvent('file_upload_started', {
          endpoint,
          fileType: file.type,
          fileSize: file.size,
        });
        
        // Make the request
        const response = await fetch(url, options);
        
        // Clear timeout
        clearTimeout(timeoutId);
        
        // Parse response
        let data;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
        
        if (response.ok) {
          // Log success
          AnalyticsService.logEvent('file_upload_success', {
            endpoint,
            fileType: file.type,
            fileSize: file.size,
          });
          
          return data;
        } else {
          // Handle error
          const error = {
            status: response.status,
            message: data.message || 'File upload failed',
            data,
          };
          
          throw error;
        }
      } catch (error) {
        // Handle timeout
        if (error.name === 'AbortError') {
          throw {
            status: 0,
            message: 'File upload timed out. Please try again.',
            isTimeout: true,
          };
        }
        
        // Log error
        AnalyticsService.logEvent('file_upload_error', {
          endpoint,
          fileType: file.type,
          fileSize: file.size,
          error: error.message,
        });
        
        throw error;
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      AnalyticsService.logError(error, { 
        context: 'upload_file',
        endpoint,
        fileType: file?.type,
        fileSize: file?.size,
      });
      
      throw error;
    }
  }
}

export default new ApiClient();

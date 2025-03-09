// src/utils/errorUtils.js
// Improved utility functions for error handling and error messages

/**
 * Get friendly error message for authentication errors
 * Enhanced with more comprehensive error codes
 * 
 * @param {Error} error - Firebase auth error object
 * @param {string} context - Context of the error (login, registration, reset)
 * @returns {string} User-friendly error message
 */
export const getAuthErrorMessage = (error, context = 'auth') => {
  // Default error message for different contexts
  const defaultMessages = {
    login: 'Unable to sign in. Please check your credentials and try again.',
    registration: 'Unable to create account. Please try again.',
    reset: 'Unable to reset password. Please try again.',
    verification: 'Unable to verify email. Please try again.',
    update: 'Unable to update account. Please try again.',
    auth: 'Authentication error. Please try again.'
  };

  // Extract error code
  const errorCode = error.code || '';
  const errorMessage = error.message || '';
  
  // Common authentication errors with user-friendly messages
  const authErrorMessages = {
    // Email/Password errors
    'auth/invalid-email': 'The email address format is not valid.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/user-not-found': context === 'reset'
      ? 'No account found with this email address.'
      : 'Invalid email or password.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/email-already-in-use': 'This email is already in use. Please use a different email or try logging in.',
    'auth/weak-password': 'Password should be at least 8 characters with a mix of letters, numbers, and symbols.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
    
    // Rate limiting and security
    'auth/too-many-requests': 'Too many unsuccessful attempts. Please wait a moment before trying again.',
    'auth/quota-exceeded': 'Service temporarily unavailable. Please try again later.',
    
    // Network issues
    'auth/network-request-failed': 'Network error. Please check your internet connection and try again.',
    'auth/timeout': 'Request timeout. Please try again.',
    
    // Account recovery and verification
    'auth/expired-action-code': 'This link has expired. Please request a new one.',
    'auth/invalid-action-code': 'This link is invalid or has already been used.',
    'auth/invalid-verification-code': 'Invalid verification code. Please try again.',
    'auth/missing-verification-code': 'Please enter the verification code sent to your device.',
    'auth/account-exists-with-different-credential': 'An account already exists with the same email but different sign-in credentials.',
    
    // OAuth and third-party auth
    'auth/popup-closed-by-user': 'Sign in was cancelled. Please try again.',
    'auth/popup-blocked': 'Pop-up blocked by browser. Please allow pop-ups and try again.',
    'auth/unauthorized-domain': 'This domain is not authorized for OAuth operations.',
    'auth/cancelled-popup-request': 'The authentication request was cancelled.',
    
    // Phone auth
    'auth/invalid-phone-number': 'The phone number format is not valid.',
    'auth/missing-phone-number': 'Please provide a valid phone number.',
    'auth/quota-exceeded': 'SMS quota exceeded. Please try again later.',
    'auth/captcha-check-failed': 'reCAPTCHA verification failed. Please try again.',
    'auth/missing-verification-id': 'Missing verification ID. Please request a new code.',
    
    // Credential management
    'auth/credential-already-in-use': 'This credential is already associated with another account.',
    'auth/requires-recent-login': 'For security reasons, please sign in again before performing this action.',
    'auth/provider-already-linked': 'This account is already linked with another provider.',
    'auth/invalid-credential': 'The credential is malformed or has expired.',
    'auth/invalid-password': 'The password is invalid.',
    'auth/invalid-user-token': 'User credentials are no longer valid. Please sign in again.',
    
    // Custom token and JWT
    'auth/invalid-custom-token': 'The custom token format is incorrect.',
    'auth/custom-token-mismatch': 'The custom token corresponds to a different audience.',
    'auth/jwt-expired': 'The provided JWT has expired.',
    'auth/invalid-api-key': 'Invalid API key provided.',
    
    // Generic/Other
    'auth/internal-error': 'An internal authentication error occurred. Please try again later.',
    'auth/invalid-tenant-id': 'Invalid tenant configuration.',
    'auth/app-deleted': 'This authentication instance has been deleted.',
    'auth/argument-error': 'Invalid argument provided.',
    'auth/invalid-persistence-type': 'Invalid persistence type specified.',
    'auth/unsupported-persistence-type': 'The current environment does not support the specified persistence type.',
    'auth/web-storage-unsupported': 'Web storage is not supported or is disabled in this environment.',
    'auth/invalid-oauth-provider': 'The specified OAuth provider is not supported.',
    'auth/invalid-oauth-client-id': 'The OAuth client ID is invalid.',
    'auth/invalid-cert-hash': 'The SHA-1 certificate hash is invalid.',
  };
  
  // Check for specific error messages first
  if (errorCode && authErrorMessages[errorCode]) {
    return authErrorMessages[errorCode];
  }
  
  // Check for common patterns in error message if code is not recognized
  if (errorMessage) {
    if (errorMessage.includes('password') && errorMessage.includes('weak')) {
      return 'Password is too weak. Please use a stronger password.';
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'Network error. Please check your internet connection and try again.';
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return 'Request timed out. Please try again.';
    }
    
    // Return the Firebase error message as fallback if it seems user-friendly
    if (errorMessage.length < 100 && !errorMessage.includes('api key') && !errorMessage.includes('API key')) {
      return errorMessage;
    }
  }
  
  // Use context-specific default message
  return defaultMessages[context] || defaultMessages.auth;
};

/**
 * Get friendly error message for Firestore errors
 * Enhanced with more detailed error types
 * 
 * @param {Error} error - Firestore error object
 * @param {string} context - Context of the error
 * @returns {string} User-friendly error message
 */
export const getFirestoreErrorMessage = (error, context = 'data') => {
  // Default error messages based on context
  const defaultMessages = {
    data: 'Database error. Please try again.',
    profile: 'Failed to update profile. Please try again.',
    post: 'Failed to process post. Please try again.',
    comment: 'Failed to process comment. Please try again.',
    connection: 'Failed to process connection. Please try again.',
    upload: 'Failed to upload data. Please try again.',
    delete: 'Failed to delete data. Please try again.',
    query: 'Failed to retrieve data. Please try again.'
  };

  const errorCode = error.code || '';
  const errorMessage = error.message || '';
  
  // Common Firestore error codes with user-friendly messages
  const firestoreErrorMessages = {
    // Permission errors
    'permission-denied': 'You don\'t have permission to perform this action.',
    'firestore/permission-denied': 'You don\'t have permission to perform this action.',
    
    // Not found errors
    'not-found': 'The requested data could not be found.',
    'firestore/not-found': 'The requested data could not be found.',
    
    // Duplicates
    'already-exists': 'This data already exists.',
    'firestore/already-exists': 'This data already exists.',
    
    // Quota and rate limiting
    'resource-exhausted': 'You\'ve reached the limit for this action. Please try again later.',
    'firestore/resource-exhausted': 'You\'ve reached the limit for this action. Please try again later.',
    
    // Precondition failures
    'failed-precondition': 'This operation cannot be performed at this time. The data may have changed.',
    'firestore/failed-precondition': 'This operation cannot be performed at this time. The data may have changed.',
    
    // Transaction errors
    'aborted': 'The operation was aborted. Please try again.',
    'firestore/aborted': 'The operation was aborted. Please try again.',
    
    // Range errors
    'out-of-range': 'The operation was attempted past the valid range.',
    'firestore/out-of-range': 'The operation was attempted past the valid range.',
    
    // Feature availability
    'unimplemented': 'This feature is not available.',
    'firestore/unimplemented': 'This feature is not available.',
    
    // Internal errors
    'internal': 'An internal error occurred. Please try again later.',
    'firestore/internal': 'An internal error occurred. Please try again later.',
    
    // Network errors
    'unavailable': 'The service is currently unavailable. Please check your internet connection.',
    'firestore/unavailable': 'The service is currently unavailable. Please check your internet connection.',
    
    // Data integrity
    'data-loss': 'Unrecoverable data loss or corruption.',
    'firestore/data-loss': 'Unrecoverable data loss or corruption.',
    
    // Authentication
    'unauthenticated': 'You need to be logged in to perform this action.',
    'firestore/unauthenticated': 'You need to be logged in to perform this action.',
    
    // Cancelled
    'cancelled': 'Operation was cancelled.',
    'firestore/cancelled': 'Operation was cancelled.',
    
    // Invalid argument
    'invalid-argument': 'Invalid data provided for this operation.',
    'firestore/invalid-argument': 'Invalid data provided for this operation.',
    
    // Deadline exceeded
    'deadline-exceeded': 'The operation took too long to complete. Please try again.',
    'firestore/deadline-exceeded': 'The operation took too long to complete. Please try again.',
  };
  
  // Check for specific error codes first
  if (errorCode && firestoreErrorMessages[errorCode]) {
    return firestoreErrorMessages[errorCode];
  }
  
  // Check for patterns in error message if code is not recognized
  if (errorMessage) {
    if (errorMessage.includes('permission') || errorMessage.includes('access')) {
      return 'You don\'t have permission to perform this action.';
    }
    
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      return 'The requested data could not be found.';
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'Network error. Please check your internet connection and try again.';
    }
    
    if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      return 'You\'ve reached the usage limit. Please try again later.';
    }
    
    // Return the Firestore error message as fallback if it seems user-friendly
    if (errorMessage.length < 100 && !errorMessage.includes('api key') && !errorMessage.includes('API key')) {
      return errorMessage;
    }
  }
  
  // Use context-specific default message
  return defaultMessages[context] || defaultMessages.data;
};

/**
 * Get friendly error message for Storage errors
 * Enhanced with more comprehensive error types
 * 
 * @param {Error} error - Storage error object
 * @param {string} context - Context of the error (upload, download)
 * @returns {string} User-friendly error message
 */
export const getStorageErrorMessage = (error, context = 'upload') => {
  // Default error messages based on context
  const defaultMessages = {
    upload: 'Failed to upload file. Please try again.',
    download: 'Failed to download file. Please try again.',
    delete: 'Failed to delete file. Please try again.',
    storage: 'Storage operation failed. Please try again.'
  };

  const errorCode = error.code || '';
  const errorMessage = error.message || '';
  
  // Common Storage error codes with user-friendly messages
  const storageErrorMessages = {
    // Object errors
    'storage/object-not-found': 'The file does not exist.',
    'storage/file-not-found': 'The file does not exist.',
    
    // Permission errors
    'storage/unauthorized': 'You don\'t have permission to access this file.',
    'storage/permission-denied': 'You don\'t have permission to access this file.',
    
    // Cancellation
    'storage/canceled': 'The operation was canceled.',
    
    // Unknown errors
    'storage/unknown': 'An unknown error occurred. Please try again.',
    
    // Retry errors
    'storage/retry-limit-exceeded': 'Maximum retry time exceeded. Please try again.',
    'storage/server-file-wrong-size': 'File upload failed due to an inconsistent file size. Please try again.',
    
    // Quota errors
    'storage/quota-exceeded': 'Storage quota has been exceeded.',
    
    // Authentication
    'storage/unauthenticated': 'You need to be logged in to perform this action.',
    
    // URL errors
    'storage/invalid-url': 'Invalid storage URL.',
    
    // Argument errors
    'storage/invalid-argument': 'Invalid argument for storage operation.',
    
    // Configuration errors
    'storage/no-default-bucket': 'No default storage bucket configured.',
    
    // Blob errors
    'storage/cannot-slice-blob': 'File could not be prepared for upload.',
    
    // Upload errors
    'storage/invalid-checksum': 'File upload failed due to data corruption. Please try again.',
    'storage/non-matching-checksum': 'File integrity check failed. Please try again.',
    
    // Download errors
    'storage/download-size-exceeded': 'The file is too large to download on this device.',
    
    // Metadata errors
    'storage/metadata-exists': 'The metadata already exists.',
    'storage/invalid-metadata': 'Invalid metadata provided.',
  };
  
  // Check for specific error codes first
  if (errorCode && storageErrorMessages[errorCode]) {
    return storageErrorMessages[errorCode];
  }
  
  // Check for patterns in error message if code is not recognized
  if (errorMessage) {
    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      return 'You don\'t have permission to access this file.';
    }
    
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      return 'The requested file could not be found.';
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'Network error. Please check your internet connection and try again.';
    }
    
    if (errorMessage.includes('quota') || errorMessage.includes('storage limit')) {
      return 'Storage quota has been exceeded.';
    }
    
    if (errorMessage.includes('too large') || errorMessage.includes('size limit')) {
      return 'The file is too large to upload.';
    }
    
    // Return the Storage error message as fallback if it seems user-friendly
    if (errorMessage.length < 100 && !errorMessage.includes('api key') && !errorMessage.includes('API key')) {
      return errorMessage;
    }
  }
  
  // Use context-specific default message
  return defaultMessages[context] || defaultMessages.storage;
};

/**
 * Get friendly error message for network errors
 * Enhanced with more specific error types
 * 
 * @param {Error} error - Network error object
 * @returns {string} User-friendly error message
 */
export const getNetworkErrorMessage = (error) => {
  const errorMessage = error.message || '';
  
  // Check for common network error patterns
  if (errorMessage.includes('Network request failed')) {
    return 'Network error. Please check your internet connection.';
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'Connection timed out. Please try again when you have a better connection.';
  }
  
  if (errorMessage.includes('connection') || errorMessage.includes('network')) {
    return 'Connection problem. Please check your internet and try again.';
  }
  
  if (errorMessage.includes('offline') || errorMessage.includes('internet')) {
    return 'You appear to be offline. Please check your internet connection.';
  }
  
  if (errorMessage.includes('host') || errorMessage.includes('DNS')) {
    return 'Unable to reach server. The service may be temporarily unavailable.';
  }
  
  if (errorMessage.includes('abort') || errorMessage.includes('aborted')) {
    return 'The connection was aborted. Please try again.';
  }
  
  if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
    return 'A network security issue occurred. Please try again later.';
  }
  
  return error.message || 'An unexpected network error occurred. Please try again.';
};

/**
 * Get API error message from response with improved parsing
 * 
 * @param {Object} response - API response object
 * @returns {string} Error message
 */
export const getApiErrorMessage = (response) => {
  if (!response) {
    return 'Unknown error occurred';
  }
  
  try {
    // Try to extract error messages from common API response formats
    
    // Check for standard error structure
    if (response.error?.message) {
      return response.error.message;
    }
    
    // Check for simple message property
    if (response.message) {
      return response.message;
    }
    
    // Check for errors array
    if (response.errors && Array.isArray(response.errors)) {
      if (response.errors.length === 0) {
        return 'An error occurred with no detailed information';
      }
      
      // Handle different error object structures
      return response.errors.map(e => {
        if (typeof e === 'string') return e;
        if (e.message) return e.message;
        if (e.msg) return e.msg;
        if (e.detail) return e.detail;
        if (e.description) return e.description;
        return JSON.stringify(e);
      }).join('. ');
    }
    
    // Check for descriptive properties that might contain error details
    if (response.detail) {
      return response.detail;
    }
    
    if (response.description) {
      return response.description;
    }
    
    // Check for status text if present
    if (response.statusText) {
      return `${response.statusText}: ${response.status || ''}`;
    }
    
    // If response is a string, return it directly
    if (typeof response === 'string') {
      return response;
    }
    
    // Try to convert the whole response to a string if all else fails
    try {
      const responseString = JSON.stringify(response);
      if (responseString.length < 100) {
        return responseString;
      }
    } catch (e) {
      // Ignore stringification errors
    }
    
    return 'Server returned an error. Please try again.';
  } catch (e) {
    return 'Failed to process server response';
  }
};

/**
 * Handle error with appropriate logging and user message
 * Enhanced with better context handling and recovery options
 * 
 * @param {Error} error - Error object
 * @param {string} context - Context of the error
 * @param {boolean} silent - Whether to return silently without throwing
 * @param {Object} options - Additional options
 * @returns {string} User-friendly error message
 */
export const handleError = (error, context = 'general', silent = false, options = {}) => {
  const {
    logToConsole = true,
    logToServer = false,
    includeStackTrace = true,
    userId = null,
    fallbackMessage = 'An unexpected error occurred. Please try again.'
  } = options;
  
  // Track original error for debugging
  const originalError = error;
  
  // Determine error type and get appropriate message
  let errorMessage = '';
  
  // Detect error type based on error properties or error.code
  if (error.code && (error.code.startsWith('auth/') || context === 'auth' || context === 'login' || context === 'signup')) {
    errorMessage = getAuthErrorMessage(error, context);
  } else if (error.code && (
    error.code === 'permission-denied' ||
    error.code === 'not-found' ||
    error.code === 'already-exists' ||
    error.code.startsWith('firestore/') ||
    context === 'database' ||
    context === 'data'
  )) {
    errorMessage = getFirestoreErrorMessage(error, context);
  } else if (error.code && (
    error.code.startsWith('storage/') ||
    context === 'storage' ||
    context === 'upload' ||
    context === 'download'
  )) {
    errorMessage = getStorageErrorMessage(error, context);
  } else if (error.message && (
    error.message.includes('Network request failed') || 
    error.message.includes('timeout') ||
    error.message.includes('connection') ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('error occurred') ||
    error.message.includes('CORS') ||
    context === 'network' ||
    context === 'api'
  )) {
    errorMessage = getNetworkErrorMessage(error);
  } else {
    // Use message directly if available, otherwise fallback message
    errorMessage = error.message || fallbackMessage;
  }
  
  // Log error for debugging
  if (logToConsole) {
    const errorInfo = {
      context,
      message: errorMessage,
      originalMessage: originalError.message,
      code: originalError.code,
      userId
    };
    
    if (includeStackTrace && originalError.stack) {
      errorInfo.stack = originalError.stack;
    }
    
    console.error(`Error (${context}):`, errorInfo);
  }
  
  // Log to server for monitoring if requested
  if (logToServer && typeof options.serverLogger === 'function') {
    try {
      options.serverLogger({
        context,
        message: errorMessage,
        originalMessage: originalError.message,
        code: originalError.code,
        userId,
        timestamp: new Date().toISOString(),
        stack: includeStackTrace ? originalError.stack : undefined
      });
    } catch (loggingError) {
      console.error('Error logging to server:', loggingError);
    }
  }
  
  // Either throw the error with the user-friendly message or return it
  if (silent) {
    return errorMessage;
  } else {
    const friendlyError = new Error(errorMessage);
    friendlyError.originalError = originalError;
    friendlyError.context = context;
    throw friendlyError;
  }
};

/**
 * Display appropriate error message based on network status
 * Enhanced with more specific offline handling
 * 
 * @param {Error} error - The error object
 * @param {boolean} isConnected - Current network connection status
 * @param {Object} options - Additional options
 * @returns {string} User-friendly error message
 */
export const getNetworkAwareErrorMessage = (error, isConnected, options = {}) => {
  const {
    offlineMessage = "You're offline. Please check your internet connection and try again.",
    context = 'general',
    includeRetryInfo = true
  } = options;
  
  if (!isConnected) {
    return includeRetryInfo 
      ? `${offlineMessage} Your changes will be saved locally and synchronized when you're back online.`
      : offlineMessage;
  }
  
  // Check if error indicates offline state despite network reporting as online
  const errorMessage = error.message?.toLowerCase() || '';
  if (
    errorMessage.includes('offline') ||
    errorMessage.includes('internet') ||
    errorMessage.includes('network') ||
    errorMessage.includes('connection')
  ) {
    return includeRetryInfo
      ? "Your connection appears to be unstable. Please try again. Your changes will be saved locally if the connection fails."
      : "Your connection appears to be unstable. Please check your internet connection and try again.";
  }
  
  return handleError(error, context, true);
};

/**
 * Format validation errors into a human-readable message
 * Enhanced with better hierarchy support
 * 
 * @param {Object|Array|string} errors - Validation errors
 * @param {Object} options - Formatting options
 * @returns {string} Formatted error message
 */
export const formatValidationErrors = (errors, options = {}) => {
  const {
    includeFieldNames = true,
    separator = '\n',
    prefix = '',
    suffix = ''
  } = options;
  
  if (!errors) return '';
  
  if (typeof errors === 'string') return prefix + errors + suffix;
  
  if (Array.isArray(errors)) {
    return prefix + errors.filter(Boolean).join(separator) + suffix;
  }
  
  if (typeof errors === 'object') {
    // Handle nested error objects
    const formattedErrors = [];
    
    for (const [field, error] of Object.entries(errors)) {
      if (typeof error === 'string') {
        formattedErrors.push(includeFieldNames ? `${field}: ${error}` : error);
      } else if (typeof error === 'object' && error !== null) {
        // Handle nested objects (e.g. form sections)
        if (Object.keys(error).length > 0) {
          const nestedErrors = formatValidationErrors(error, {
            includeFieldNames,
            separator,
            prefix: includeFieldNames ? `${field}: ` : '',
            suffix: ''
          });
          
          if (nestedErrors) {
            formattedErrors.push(nestedErrors);
          }
        }
      } else if (Array.isArray(error)) {
        // Handle arrays of errors for a single field
        if (error.length > 0) {
          const fieldErrors = error.filter(Boolean).join(', ');
          if (fieldErrors) {
            formattedErrors.push(includeFieldNames ? `${field}: ${fieldErrors}` : fieldErrors);
          }
        }
      }
    }
    
    return prefix + formattedErrors.join(separator) + suffix;
  }
  
  return 'Validation failed. Please check your input.';
};

/**
 * Handle errors when using async/await with try/catch
 * Enhanced with progress tracking and timeout support
 * 
 * @param {function} fn - Async function to execute
 * @param {Object} options - Options for error handling
 * @returns {Promise<*>} - Result of the function or error
 */
export const withErrorHandling = async (fn, options = {}) => {
  const { 
    context = 'general', 
    silent = false,
    onError = null,
    onSuccess = null,
    finallyFn = null,
    timeout = 0,  // 0 means no timeout
    retry = 0,    // Number of retries
    retryDelay = 1000, // Delay between retries in ms
    onProgress = null // Progress callback if supported
  } = options;
  
  let timeoutId = null;
  let attempts = 0;
  
  try {
    // Set up timeout if specified
    const timeoutPromise = timeout > 0
      ? new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Operation timed out after ${timeout}ms`));
          }, timeout);
        })
      : null;
    
    const executeWithRetry = async () => {
      attempts++;
      
      try {
        // Execute the function, with progress handling if available
        if (onProgress && typeof fn === 'function' && fn.length > 0) {
          // If function accepts progress callback parameter
          return await fn(onProgress);
        } else {
          return await fn();
        }
      } catch (error) {
        // If we still have retries remaining, try again after delay
        if (attempts <= retry) {
          console.log(`Retry attempt ${attempts}/${retry} after error:`, error.message);
          
          // Wait for the retry delay
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          // Implement exponential backoff if retry > 1
          if (retry > 1) {
            options.retryDelay = retryDelay * 2;
          }
          
          // Try again
          return executeWithRetry();
        }
        
        // No more retries, propagate the error
        throw error;
      }
    };
    
    // Execute the function with timeout if specified
    const result = await (timeoutPromise
      ? Promise.race([executeWithRetry(), timeoutPromise])
      : executeWithRetry());
    
    // Clear timeout if set
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Call success callback if provided
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(result);
    }
    
    return result;
  } catch (error) {
    // Clear timeout if set
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    const errorMessage = handleError(error, context, true);
    
    if (onError && typeof onError === 'function') {
      onError(errorMessage, error);
    }
    
    if (!silent) {
      throw new Error(errorMessage);
    }
    
    return { error: errorMessage, originalError: error };
  } finally {
    if (finallyFn && typeof finallyFn === 'function') {
      finallyFn();
    }
  }
};

/**
 * Group related error handlers together for export
 */
export default {
  getAuthErrorMessage,
  getFirestoreErrorMessage,
  getStorageErrorMessage,
  getNetworkErrorMessage,
  getApiErrorMessage,
  handleError,
  getNetworkAwareErrorMessage,
  formatValidationErrors,
  withErrorHandling
};
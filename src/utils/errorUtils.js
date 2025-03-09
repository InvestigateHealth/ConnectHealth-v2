// src/utils/errorUtils.js
// Utility functions for error handling and error messages

/**
 * Get friendly error message for authentication errors
 * 
 * @param {Error} error - Firebase auth error object
 * @param {string} context - Context of the error (login, registration, reset)
 * @returns {string} User-friendly error message
 */
export const getAuthErrorMessage = (error, context = 'auth') => {
  const errorCode = error.code || '';
  
  // Common authentication errors
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'The email address is not valid.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return context === 'reset'
        ? 'No account found with this email address.'
        : 'Invalid email or password.';
    case 'auth/wrong-password':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'This email is already in use. Please use a different email or try logging in.';
    case 'auth/weak-password':
      return 'Password should be at least 8 characters with uppercase, lowercase letters and numbers.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/invalid-verification-code':
      return 'Invalid verification code. Please try again.';
    case 'auth/operation-not-allowed':
      return 'This operation is not allowed.';
    case 'auth/expired-action-code':
      return 'This link has expired. Please request a new one.';
    case 'auth/invalid-action-code':
      return 'This link is invalid. It may have been used already or it has expired.';
    case 'auth/popup-closed-by-user':
      return 'Sign in was cancelled.';
    case 'auth/unauthorized-domain':
      return 'Authentication failed. Please try again.';
    case 'auth/missing-verification-code':
      return 'Please enter the verification code sent to your phone.';
    case 'auth/credential-already-in-use':
      return 'This account is already connected to another user.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with the same email address but different sign-in credentials.';
    case 'auth/requires-recent-login':
      return 'For security reasons, please sign in again before performing this action.';
    default:
      // Context-specific default messages
      if (context === 'login') {
        return 'Failed to sign in. Please check your credentials and try again.';
      } else if (context === 'registration') {
        return 'Failed to create account. Please try again.';
      } else if (context === 'reset') {
        return 'Failed to send password reset email. Please try again.';
      } else {
        return error.message || 'An unexpected error occurred. Please try again.';
      }
  }
};

/**
 * Get friendly error message for Firestore errors
 * 
 * @param {Error} error - Firestore error object
 * @param {string} context - Context of the error
 * @returns {string} User-friendly error message
 */
export const getFirestoreErrorMessage = (error, context = 'data') => {
  const errorCode = error.code || '';
  
  switch (errorCode) {
    case 'permission-denied':
      return 'You don\'t have permission to perform this action.';
    case 'not-found':
      return 'The requested data could not be found.';
    case 'already-exists':
      return 'This data already exists.';
    case 'resource-exhausted':
      return 'You\'ve reached the limit for this action. Please try again later.';
    case 'failed-precondition':
      return 'This operation cannot be performed at this time.';
    case 'aborted':
      return 'The operation was aborted. Please try again.';
    case 'out-of-range':
      return 'The operation was attempted past the valid range.';
    case 'unimplemented':
      return 'This feature is not available.';
    case 'internal':
      return 'An internal error occurred. Please try again later.';
    case 'unavailable':
      return 'The service is currently unavailable. Please check your internet connection.';
    case 'data-loss':
      return 'Unrecoverable data loss or corruption.';
    case 'unauthenticated':
      return 'You need to be logged in to perform this action.';
    case 'cancelled':
      return 'Operation was cancelled.';
    default:
      // Context-specific default messages
      if (context === 'profile') {
        return error.message || 'Failed to update profile. Please try again.';
      } else if (context === 'post') {
        return error.message || 'Failed to process post. Please try again.';
      } else if (context === 'comment') {
        return error.message || 'Failed to process comment. Please try again.';
      } else if (context === 'connection') {
        return error.message || 'Failed to process connection. Please try again.';
      } else {
        return error.message || 'An unexpected error occurred. Please try again.';
      }
  }
};

/**
 * Get friendly error message for Storage errors
 * 
 * @param {Error} error - Storage error object
 * @param {string} context - Context of the error (upload, download)
 * @returns {string} User-friendly error message
 */
export const getStorageErrorMessage = (error, context = 'upload') => {
  const errorCode = error.code || '';
  
  switch (errorCode) {
    case 'storage/object-not-found':
      return 'The file does not exist.';
    case 'storage/unauthorized':
      return 'You don\'t have permission to access this file.';
    case 'storage/canceled':
      return 'The operation was canceled.';
    case 'storage/unknown':
      return 'An unknown error occurred. Please try again.';
    case 'storage/retry-limit-exceeded':
      return 'Maximum retry time exceeded. Please try again.';
    case 'storage/invalid-checksum':
      return 'File upload failed due to data corruption. Please try again.';
    case 'storage/server-file-wrong-size':
      return 'File upload failed due to an inconsistent file size. Please try again.';
    case 'storage/quota-exceeded':
      return 'Storage quota has been exceeded.';
    case 'storage/unauthenticated':
      return 'You need to be logged in to perform this action.';
    case 'storage/invalid-url':
      return 'Invalid storage URL.';
    case 'storage/invalid-argument':
      return 'Invalid argument for storage operation.';
    case 'storage/no-default-bucket':
      return 'No default storage bucket configured.';
    case 'storage/cannot-slice-blob':
      return 'File could not be prepared for upload.';
    case 'storage/non-matching-checksum':
      return 'File integrity check failed. Please try again.';
    default:
      // Context-specific default messages
      if (context === 'upload') {
        return error.message || 'Failed to upload file. Please try again.';
      } else if (context === 'download') {
        return error.message || 'Failed to download file. Please try again.';
      } else if (context === 'delete') {
        return error.message || 'Failed to delete file. Please try again.';
      } else {
        return error.message || 'An unexpected error occurred. Please try again.';
      }
  }
};

/**
 * Get friendly error message for network errors
 * 
 * @param {Error} error - Network error object
 * @returns {string} User-friendly error message
 */
export const getNetworkErrorMessage = (error) => {
  if (error.message && error.message.includes('Network request failed')) {
    return 'Network error. Please check your internet connection.';
  } else if (error.message && error.message.includes('timeout')) {
    return 'Connection timed out. Please try again.';
  } else if (error.message && error.message.includes('connection')) {
    return 'Connection problem. Please check your internet and try again.';
  }
  
  return error.message || 'An unexpected network error occurred. Please try again.';
};

/**
 * Get API error message from response
 * 
 * @param {Object} response - API response object
 * @returns {string} Error message
 */
export const getApiErrorMessage = (response) => {
  if (!response) {
    return 'Unknown error occurred';
  }
  
  try {
    return await fn();
  } catch (error) {
    const errorMessage = handleError(error, context, true);
    
    if (onError && typeof onError === 'function') {
      onError(errorMessage, error);
    }
    
    if (!silent) {
      throw new Error(errorMessage);
    }
    
    return { error: errorMessage };
  } finally {
    if (finallyFn && typeof finallyFn === 'function') {
      finallyFn();
    }
  }
};

/**
 * Display appropriate error message based on network status
 * 
 * @param {Error} error - The error object
 * @param {boolean} isConnected - Current network connection status
 * @returns {string} User-friendly error message
 */
export const getNetworkAwareErrorMessage = (error, isConnected) => {
  if (!isConnected) {
    return "You're offline. Please check your internet connection and try again.";
  }
  
  return handleError(error, 'general', true);
};

/**
 * Format validation errors into a human-readable message
 * 
 * @param {Object} errors - Validation errors object
 * @returns {string} Formatted error message
 */
export const formatValidationErrors = (errors) => {
  if (!errors) return '';
  
  if (typeof errors === 'string') return errors;
  
  if (Array.isArray(errors)) {
    return errors.join('\n');
  }
  
  if (typeof errors === 'object') {
    return Object.values(errors).join('\n');
  }
  
  return 'Validation failed. Please check your input.';
}; {
    // Try to extract error messages from common API response formats
    if (response.error?.message) {
      return response.error.message;
    } else if (response.message) {
      return response.message;
    } else if (response.errors && Array.isArray(response.errors)) {
      return response.errors.map(e => e.message || e).join('. ');
    } else if (typeof response === 'string') {
      return response;
    } else {
      return 'Server returned an error. Please try again.';
    }
  } catch (e) {
    return 'Failed to process server response';
  }
};

/**
 * Handle error with appropriate logging and user message
 * 
 * @param {Error} error - Error object
 * @param {string} context - Context of the error
 * @param {boolean} silent - Whether to return silently without throwing
 * @returns {string} User-friendly error message
 */
export const handleError = (error, context = 'general', silent = false) => {
  // Determine error type and get appropriate message
  let errorMessage = '';
  
  if (error.code && error.code.startsWith('auth/')) {
    errorMessage = getAuthErrorMessage(error, context);
  } else if (error.code && (
    error.code === 'permission-denied' ||
    error.code === 'not-found' ||
    error.code === 'already-exists' ||
    error.code.startsWith('firestore/')
  )) {
    errorMessage = getFirestoreErrorMessage(error, context);
  } else if (error.code && error.code.startsWith('storage/')) {
    errorMessage = getStorageErrorMessage(error, context);
  } else if (error.message && (
    error.message.includes('Network request failed') || 
    error.message.includes('timeout') ||
    error.message.includes('connection')
  )) {
    errorMessage = getNetworkErrorMessage(error);
  } else {
    errorMessage = error.message || 'An unexpected error occurred. Please try again.';
  }
  
  // Log error for debugging
  console.error(`Error (${context}):`, error);
  
  // Either throw the error with the user-friendly message or return it
  if (silent) {
    return errorMessage;
  } else {
    throw new Error(errorMessage);
  }
};

/**
 * Handle errors when using async/await with try/catch
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
    finallyFn = null
  } = options;
  
  try
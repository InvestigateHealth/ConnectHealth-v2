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
      return 'Password should be at least 6 characters.';
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
    default:
      // Context-specific default messages
      if (context === 'profile') {
        return 'Failed to update profile. Please try again.';
      } else if (context === 'post') {
        return 'Failed to process post. Please try again.';
      } else if (context === 'comment') {
        return 'Failed to process comment. Please try again.';
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
    default:
      // Context-specific default messages
      if (context === 'upload') {
        return 'Failed to upload file. Please try again.';
      } else if (context === 'download') {
        return 'Failed to download file. Please try again.';
      } else if (context === 'delete') {
        return 'Failed to delete file. Please try again.';
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
  }
  
  return error.message || 'An unexpected network error occurred. Please try again.';
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
    error.code === 'already-exists'
  )) {
    errorMessage = getFirestoreErrorMessage(error, context);
  } else if (error.code && error.code.startsWith('storage/')) {
    errorMessage = getStorageErrorMessage(error, context);
  } else if (error.message && error.message.includes('Network request failed')) {
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
 * Format validation errors into a user-friendly message
 * 
 * @param {Object} errors - Validation errors object
 * @returns {string} User-friendly error message
 */
export const formatValidationErrors = (errors) => {
  if (!errors) return 'Validation failed.';
  
  if (typeof errors === 'string') return errors;
  
  if (Array.isArray(errors)) {
    return errors.join('\n');
  }
  
  // Handle object of errors
  return Object.entries(errors)
    .map(([field, message]) => `${field}: ${message}`)
    .join('\n');
};

/**
 * Validate email format
 * 
 * @param {string} email - Email to validate
 * @returns {boolean} Whether the email is valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * 
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and message
 */
export const validatePassword = (password) => {
  if (!password || password.length < 6) {
    return {
      isValid: false,
      message: 'Password should be at least 6 characters.'
    };
  }
  
  // You can add more complex validation rules here if needed
  /*
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    return {
      isValid: false,
      message: 'Password must contain uppercase, lowercase, number, and special character.'
    };
  }
  */
  
  return {
    isValid: true,
    message: ''
  };
};

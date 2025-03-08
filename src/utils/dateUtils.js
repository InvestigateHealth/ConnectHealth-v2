// src/utils/dateUtils.js
// Utilities for date formatting and handling

import { format, formatDistanceToNow, isValid } from 'date-fns';

/**
 * Format a timestamp for display in the app.
 * 
 * @param {Date|Timestamp} timestamp - Firebase timestamp or Date object
 * @param {boolean} useRelative - Whether to use relative time for recent dates
 * @returns {string} Formatted date string
 */
export const formatTimestamp = (timestamp, useRelative = true) => {
  if (!timestamp) return '';
  
  try {
    // Handle Firebase Timestamp objects
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    if (!isValid(date)) {
      return '';
    }
    
    // For recent dates, use relative time if requested
    if (useRelative && new Date() - date < 24 * 60 * 60 * 1000) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    
    // Otherwise use standard date format
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
};

/**
 * Format join date for user profiles
 * 
 * @param {Date|Timestamp} timestamp - Firebase timestamp or Date object
 * @returns {string} Formatted join date
 */
export const formatJoinDate = (timestamp) => {
  if (!timestamp) return 'Recently';
  
  try {
    // Handle Firebase Timestamp objects
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    if (!isValid(date)) {
      return 'Recently';
    }
    
    return format(date, 'MMMM yyyy');
  } catch (error) {
    console.error('Error formatting join date:', error);
    return 'Recently';
  }
};

// src/utils/errorUtils.js
// Utilities for error handling and messages

/**
 * Process Firebase authentication errors into user-friendly messages
 * 
 * @param {Error} error - Firebase error object
 * @param {string} actionType - Type of action (e.g., 'login', 'registration')
 * @returns {string} User-friendly error message
 */
export const getAuthErrorMessage = (error, actionType = 'auth') => {
  const errorCode = error.code || '';
  
  // Authentication errors
  if (errorCode === 'auth/email-already-in-use') {
    return 'This email address is already in use.';
  } else if (errorCode === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  } else if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
    return 'Invalid email or password.';
  } else if (errorCode === 'auth/weak-password') {
    return 'Please choose a stronger password.';
  } else if (errorCode === 'auth/network-request-failed') {
    return 'Network error. Please check your connection and try again.';
  } else if (errorCode === 'auth/too-many-requests') {
    return 'Too many failed attempts. Please try again later.';
  } else if (errorCode === 'auth/user-disabled') {
    return 'This account has been disabled.';
  }
  
  // Firestore errors
  if (errorCode === 'permission-denied') {
    return 'You don\'t have permission to perform this action.';
  }
  
  // Default error messages based on action type
  switch (actionType) {
    case 'login':
      return 'Failed to log in. Please try again.';
    case 'registration':
      return 'Registration failed. Please try again.';
    case 'post':
      return 'Failed to create post. Please try again.';
    case 'comment':
      return 'Failed to save comment. Please try again.';
    case 'profile':
      return 'Failed to update profile. Please try again.';
    case 'fetch':
      return 'Failed to load data. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

// src/utils/validationUtils.js
// Form validation utilities

/**
 * Validate email format
 * 
 * @param {string} email - Email address to validate
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
 * @returns {Object} Validation result with isValid and reason
 */
export const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return {
      isValid: false,
      reason: 'Password must be at least 8 characters long.'
    };
  }
  
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (!(hasUppercase && hasLowercase && hasNumber)) {
    return {
      isValid: false,
      reason: 'Password must include uppercase, lowercase letters and numbers.'
    };
  }
  
  if (!hasSpecialChar) {
    return {
      isValid: false,
      reason: 'Password should include at least one special character.'
    };
  }
  
  return {
    isValid: true,
    reason: ''
  };
};

/**
 * Validate URL format
 * 
 * @param {string} url - URL to validate 
 * @returns {boolean} Whether the URL is valid
 */
export const isValidUrl = (url) => {
  try {
    // Add protocol if missing
    let testUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      testUrl = 'https://' + url;
    }
    
    new URL(testUrl);
    return true;
  } catch (e) {
    return false;
  }
};

// src/utils/firebaseUtils.js
// Firebase helper functions

import firestore from '@react-native-firebase/firestore';

/**
 * Create a paginated query for Firestore
 * 
 * @param {Object} options - Options for the query
 * @returns {Query} Firestore query
 */
export const createPaginatedQuery = ({ 
  collection, 
  where = [], 
  orderBy = { field: 'timestamp', direction: 'desc' },
  limit = 10,
  startAfter = null
}) => {
  let query = firestore().collection(collection);
  
  // Apply where clauses
  where.forEach(condition => {
    if (condition.length === 3) {
      query = query.where(condition[0], condition[1], condition[2]);
    }
  });
  
  // Apply ordering
  query = query.orderBy(orderBy.field, orderBy.direction);
  
  // Apply cursor if provided
  if (startAfter) {
    query = query.startAfter(startAfter);
  }
  
  // Apply limit
  query = query.limit(limit);
  
  return query;
};

/**
 * Get the domain from a URL
 * 
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain name
 */
export const getDomainFromUrl = (url) => {
  try {
    // Add protocol if missing
    let fullUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      fullUrl = 'https://' + url;
    }
    
    const domain = new URL(fullUrl).hostname.replace('www.', '');
    return domain;
  } catch (err) {
    return url;
  }
};

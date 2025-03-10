// src/utils/emailValidator.js
// Enhanced email validation with multiple validation checks

import { DISPOSABLE_EMAIL_DOMAINS } from '../constants/disposableEmailDomains';

/**
 * Comprehensive email validation utility
 * Validates email against multiple criteria
 */
export const validateEmail = (email, options = {}) => {
  // Default options
  const defaultOptions = {
    checkDisposable: true,
    checkFormat: true,
    checkEmpty: true,
    checkLength: true,
    // Additional options can be added here
    maxLength: 254, // Maximum length per RFC 5321
    minLength: 3,   // Minimum reasonable length
  };
  
  // Merge provided options with defaults
  const opts = { ...defaultOptions, ...options };
  
  // Create result object
  const result = {
    isValid: true,
    errors: [],
  };
  
  if (!email) {
    if (opts.checkEmpty) {
      result.isValid = false;
      result.errors.push('EMAIL_EMPTY');
    }
    return result;
  }
  
  // Check length
  if (opts.checkLength) {
    if (email.length > opts.maxLength) {
      result.isValid = false;
      result.errors.push('EMAIL_TOO_LONG');
    }
    
    if (email.length < opts.minLength) {
      result.isValid = false;
      result.errors.push('EMAIL_TOO_SHORT');
    }
  }
  
  // Check format using robust regex
  // This regex is more comprehensive than the simple one often used
  if (opts.checkFormat) {
    // RFC 5322 compliant regex
    const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    
    if (!emailRegex.test(email)) {
      result.isValid = false;
      result.errors.push('EMAIL_INVALID_FORMAT');
    } else {
      // Additional format checks if passes basic regex
      
      // Check if domain has at least one dot (very basic TLD check)
      const parts = email.split('@');
      if (parts.length === 2) {
        const domain = parts[1];
        
        if (!domain.includes('.')) {
          result.isValid = false;
          result.errors.push('EMAIL_INVALID_DOMAIN');
        }
        
        // Check for common typo domains (like gmail.con instead of gmail.com)
        const commonTypos = {
          'gmail.con': 'gmail.com',
          'gmail.co': 'gmail.com',
          'yahoo.con': 'yahoo.com',
          'hotmail.con': 'hotmail.com',
          'outlook.con': 'outlook.com',
        };
        
        for (const [typo, correction] of Object.entries(commonTypos)) {
          if (domain.toLowerCase() === typo) {
            result.suggestedCorrection = email.replace(typo, correction);
            result.isValid = false;
            result.errors.push('EMAIL_POSSIBLE_TYPO');
            break;
          }
        }
      }
    }
  }
  
  // Check if it's a disposable email
  if (opts.checkDisposable && result.isValid) {
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (domain && DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
      result.isValid = false;
      result.errors.push('EMAIL_DISPOSABLE');
    }
  }
  
  return result;
};

/**
 * Simplifies usage by returning just a boolean
 * @param {string} email The email to validate
 * @param {object} options Validation options
 * @returns {boolean} Whether the email is valid
 */
export const isValidEmail = (email, options = {}) => {
  return validateEmail(email, options).isValid;
};

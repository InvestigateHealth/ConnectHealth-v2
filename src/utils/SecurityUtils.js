// src/utils/SecurityUtils.js
// Utilities for security and privacy

import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import * as Keychain from 'react-native-keychain';

// Get encryption key from environment with safer fallback strategy
const getEncryptionKeyFromEnv = () => {
  try {
    // Try to import from environment
    const { ENCRYPTION_KEY } = require('@env');
    return ENCRYPTION_KEY || null;
  } catch (error) {
    console.error('Error loading encryption key from env:', error);
    return null;
  }
};

/**
 * Security utilities for encryption, data sanitization, and privacy features
 */
class SecurityUtils {
  constructor() {
    // Initialize encryption key
    this.encryptionKey = null;
    
    // Try to initialize key on startup
    this.initializeEncryptionKey();
  }

  /**
   * Initialize encryption key from secure storage
   */
  async initializeEncryptionKey() {
    try {
      // Check environment first
      const envKey = getEncryptionKeyFromEnv();
      if (envKey) {
        this.encryptionKey = envKey;
        return;
      }

      // Try to get from keychain
      const key = await this.getDeviceSpecificKey();
      if (key) {
        this.encryptionKey = key;
      }
    } catch (error) {
      console.error('Error initializing encryption key:', error);
      // Will fall back to generating a key when needed
    }
  }

  /**
   * Encrypt sensitive data
   * 
   * @param {string|object} data - Data to encrypt
   * @returns {string} Encrypted data
   */
  async encryptData(data) {
    try {
      // Convert object to string if needed
      const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
      
      // Make sure we have an encryption key
      if (!this.encryptionKey) {
        this.encryptionKey = await this.getDeviceSpecificKey();
      }
      
      // Encrypt the data
      return CryptoJS.AES.encrypt(dataString, this.encryptionKey).toString();
    } catch (error) {
      console.error('Encryption error:', error);
      return null;
    }
  }

  /**
   * Decrypt encrypted data
   * 
   * @param {string} encryptedData - Encrypted data to decrypt
   * @returns {string|object} Decrypted data
   */
  async decryptData(encryptedData) {
    try {
      if (!encryptedData) {
        return null;
      }

      // Make sure we have an encryption key
      if (!this.encryptionKey) {
        this.encryptionKey = await this.getDeviceSpecificKey();
      }
      
      // Decrypt the data
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
      
      // Try to parse as JSON, return as string if not valid JSON
      try {
        return JSON.parse(decryptedText);
      } catch {
        return decryptedText;
      }
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  /**
   * Get device-specific encryption key
   * 
   * @returns {string} Device-specific key
   */
  async getDeviceSpecificKey() {
    try {
      // Try to get key from secure storage
      const credentials = await Keychain.getGenericPassword({service: 'deviceEncryptionKey'});
      
      if (credentials && credentials.password) {
        return credentials.password;
      }
      
      // Generate a new key if not found
      const newKey = CryptoJS.lib.WordArray.random(32).toString(); // 256 bits
      
      // Save the new key
      try {
        await Keychain.setGenericPassword('deviceEncryptionKey', newKey, {
          service: 'deviceEncryptionKey',
          accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
        });
      } catch (keychainError) {
        console.error('Error saving to keychain:', keychainError);
        // Fallback to AsyncStorage
        await AsyncStorage.setItem('deviceEncryptionKey', newKey);
      }
      
      return newKey;
    } catch (error) {
      console.error('Error getting device key:', error);
      
      // Last resort: generate a device-unique key from device info and a random seed
      // This is less secure but provides a consistent key
      try {
        const existingKey = await AsyncStorage.getItem('deviceEncryptionKeyFallback');
        if (existingKey) {
          return existingKey;
        }
        
        // Create a more complex fallback key
        const randomSeed = CryptoJS.lib.WordArray.random(16).toString();
        const deviceInfo = `${Platform.OS}_${Platform.Version}_${Date.now()}_${randomSeed}`;
        const hashedKey = CryptoJS.SHA256(deviceInfo).toString();
        
        // Save this key for future use
        await AsyncStorage.setItem('deviceEncryptionKeyFallback', hashedKey);
        
        return hashedKey;
      } catch (fallbackError) {
        console.error('Error creating fallback key:', fallbackError);
        // Ultimate fallback - less secure but functional
        return CryptoJS.SHA256('HealthConnectApp_' + Date.now()).toString();
      }
    }
  }

  /**
   * Sanitize user input to prevent XSS and injection attacks
   * 
   * @param {string} input - User input to sanitize
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (!input) return '';
    
    if (typeof input !== 'string') {
      try {
        input = String(input);
      } catch (e) {
        return '';
      }
    }
    
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitize URL to prevent unsafe links
   * 
   * @param {string} url - URL to sanitize
   * @returns {string|null} Sanitized URL or null if invalid
   */
  sanitizeURL(url) {
    if (!url) return null;
    
    // Add protocol if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    // Check if URL is valid
    try {
      const parsedURL = new URL(url);
      // Only allow http and https URLs
      if (parsedURL.protocol !== 'http:' && parsedURL.protocol !== 'https:') {
        return null;
      }
      return parsedURL.toString();
    } catch (e) {
      return null;
    }
  }

  /**
   * Validate social media link
   * 
   * @param {string} url - Social media URL to validate
   * @param {string} platform - Platform to validate for (optional)
   * @returns {Object} Validation result with status and sanitized URL
   */
  validateSocialMediaLink(url, platform = null) {
    if (!url) return { isValid: false, url: null };
    
    // Add protocol if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    // Try to parse the URL
    try {
      const parsedURL = new URL(url);
      const hostname = parsedURL.hostname.toLowerCase();
      
      // Define allowed domains based on platform
      const allowedDomains = {
        facebook: ['facebook.com', 'www.facebook.com', 'fb.com', 'm.facebook.com'],
        instagram: ['instagram.com', 'www.instagram.com'],
        linkedin: ['linkedin.com', 'www.linkedin.com'],
        twitter: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
        substack: ['substack.com'],
        tiktok: ['tiktok.com', 'www.tiktok.com'],
        youtube: ['youtube.com', 'www.youtube.com', 'youtu.be'],
        medium: ['medium.com'],
        reddit: ['reddit.com', 'www.reddit.com'],
        github: ['github.com', 'www.github.com'],
      };
      
      // Check if specific platform was requested
      if (platform) {
        const isValid = allowedDomains[platform.toLowerCase()]?.some(
          domain => hostname === domain || hostname.endsWith('.' + domain)
        ) || false;
        
        return {
          isValid,
          url: isValid ? parsedURL.toString() : null,
          platform: platform.toLowerCase()
        };
      }
      
      // Check all platforms
      for (const [platformName, domains] of Object.entries(allowedDomains)) {
        if (domains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
          return {
            isValid: true,
            url: parsedURL.toString(),
            platform: platformName
          };
        }
      }
      
      // If not matching any known platform but has valid http/https protocol, accept as generic link
      if (parsedURL.protocol === 'http:' || parsedURL.protocol === 'https:') {
        return {
          isValid: true,
          url: parsedURL.toString(),
          platform: 'other'
        };
      }
      
      return { isValid: false, url: null };
    } catch (e) {
      return { isValid: false, url: null };
    }
  }

  /**
   * Store sensitive data securely
   * 
   * @param {string} key - Storage key
   * @param {string|object} data - Data to store
   * @returns {Promise<boolean>} Success status
   */
  async storeSecureData(key, data) {
    try {
      if (!key) {
        throw new Error('Storage key is required');
      }
      
      // For sensitive information, use keychain
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const stringValue = typeof data === 'object' ? JSON.stringify(data) : String(data);
        await Keychain.setGenericPassword(key, stringValue, { service: key });
      } else {
        // Fallback to encrypted AsyncStorage
        const encryptedData = await this.encryptData(data);
        await AsyncStorage.setItem(key, encryptedData);
      }
      return true;
    } catch (error) {
      console.error('Error storing secure data:', error);
      return false;
    }
  }

  /**
   * Retrieve sensitive data securely
   * 
   * @param {string} key - Storage key
   * @returns {Promise<any>} Retrieved data
   */
  async getSecureData(key) {
    try {
      if (!key) {
        throw new Error('Storage key is required');
      }
      
      // For sensitive information, use keychain
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        const credentials = await Keychain.getGenericPassword({ service: key });
        
        if (credentials) {
          // Try to parse as JSON if possible
          try {
            return JSON.parse(credentials.password);
          } catch {
            return credentials.password;
          }
        }
        return null;
      } else {
        // Fallback to encrypted AsyncStorage
        const encryptedData = await AsyncStorage.getItem(key);
        if (!encryptedData) return null;
        return await this.decryptData(encryptedData);
      }
    } catch (error) {
      console.error('Error retrieving secure data:', error);
      return null;
    }
  }

  /**
   * Remove secure data
   * 
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} Success status
   */
  async removeSecureData(key) {
    try {
      if (!key) {
        throw new Error('Storage key is required');
      }
      
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Keychain.resetGenericPassword({ service: key });
      } else {
        await AsyncStorage.removeItem(key);
      }
      return true;
    } catch (error) {
      console.error('Error removing secure data:', error);
      return false;
    }
  }

  /**
   * Check for potentially offensive content using basic pattern matching
   * 
   * @param {string} text - Text to check
   * @returns {boolean} Whether text might contain offensive content
   */
  mightContainOffensiveContent(text) {
    if (!text) return false;
    
    // Basic list of patterns to check
    const offensivePatterns = [
      /\b(fuck|shit|damn|bitch|cunt|ass|dick)\b/i,
      /\b(racist|nazi|fascist|kill|murder|die)\b/i,
      // Add more patterns as needed
    ];
    
    return offensivePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Report inappropriate content to moderators
   * 
   * @param {string} contentType - Type of content (post, comment, user)
   * @param {string} contentId - ID of the content
   * @param {string} reporterId - ID of user making the report
   * @param {string} reason - Reason for reporting
   * @returns {Promise<boolean>} Success status
   */
  async reportInappropriateContent(contentType, contentId, reporterId, reason) {
    try {
      if (!contentType || !contentId || !reporterId) {
        throw new Error('Content type, content ID, and reporter ID are required');
      }
      
      const sanitizedReason = this.sanitizeInput(reason || '');
      
      await firestore().collection('reports').add({
        contentType,
        contentId,
        reporterId,
        reason: sanitizedReason,
        timestamp: firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });
      
      return true;
    } catch (error) {
      console.error('Error reporting inappropriate content:', error);
      return false;
    }
  }

  /**
   * Generate a secure random string
   * 
   * @param {number} length - Length of the string
   * @returns {string} Random string
   */
  generateSecureRandomString(length = 16) {
    // Ensure length is at least 8 and at most 64
    const safeLength = Math.max(8, Math.min(length, 64));
    return CryptoJS.lib.WordArray.random(Math.ceil(safeLength / 2)).toString();
  }

  /**
   * Hash a password securely
   * 
   * @param {string} password - Password to hash
   * @param {string} salt - Salt for hashing
   * @returns {string} Hashed password
   */
  hashPassword(password, salt = null) {
    if (!password) {
      throw new Error('Password is required');
    }
    
    // Generate salt if not provided
    const useSalt = salt || CryptoJS.lib.WordArray.random(16).toString();
    
    // Hash password with salt
    const hash = CryptoJS.PBKDF2(password, useSalt, { 
      keySize: 512 / 32,
      iterations: 10000 // Increased from 1000 for better security
    }).toString();
    
    // Return hash and salt
    return { hash, salt: useSalt };
  }

  /**
   * Verify password against stored hash
   * 
   * @param {string} password - Password to verify
   * @param {string} hash - Stored hash
   * @param {string} salt - Salt used for hashing
   * @returns {boolean} Whether password matches
   */
  verifyPassword(password, hash, salt) {
    if (!password || !hash || !salt) {
      return false;
    }
    
    const calculatedHash = CryptoJS.PBKDF2(password, salt, { 
      keySize: 512 / 32,
      iterations: 10000 // Must match the value used in hashPassword
    }).toString();
    
    return calculatedHash === hash;
  }

  /**
   * Redact sensitive information from text
   * 
   * @param {string} text - Text to redact
   * @returns {string} Redacted text
   */
  redactSensitiveInfo(text) {
    if (!text) return '';
    
    // Patterns for common sensitive information
    const patterns = {
      // Credit card numbers
      creditCard: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
      // Social Security Numbers
      ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      // Email addresses
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      // Phone numbers
      phone: /\b(?:\+?1[-\s]?)?\(?([0-9]{3})\)?[-\s]?([0-9]{3})[-\s]?([0-9]{4})\b/g,
      // Street addresses (basic pattern)
      address: /\b\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct)\b/gi,
    };
    
    let redactedText = text;
    
    // Apply each redaction pattern
    for (const [type, pattern] of Object.entries(patterns)) {
      redactedText = redactedText.replace(pattern, match => {
        if (type === 'email') {
          // Keep domain for emails
          const parts = match.split('@');
          return '***@' + parts[1];
        } else if (type === 'creditCard') {
          // Keep last 4 digits for credit cards
          return '****-****-****-' + match.slice(-4);
        } else if (type === 'phone') {
          // Keep last 4 digits for phone numbers
          return '(***) ***-' + match.slice(-4);
        } else {
          // Full redaction for other types
          return '*'.repeat(Math.min(match.length, 8)) + '...';
        }
      });
    }
    
    return redactedText;
  }

  /**
   * Check if email domain is from disposable email provider
   * 
   * @param {string} email - Email to check
   * @returns {boolean} Whether email is from disposable provider
   */
  isDisposableEmail(email) {
    if (!email || !email.includes('@')) return false;
    
    const domain = email.split('@')[1].toLowerCase();
    
    // Common disposable email domains
    const disposableDomains = [
      'mailinator.com', 'trashmail.com', 'guerrillamail.com', 
      'tempmail.com', '10minutemail.com', 'yopmail.com',
      'disposablemail.com', 'mailnesia.com', 'mailcatch.com',
      'temp-mail.org', 'spamgourmet.com', 'dispostable.com',
      'mintemail.com', 'mailnull.com', 'mytrashmail.com',
      'throwawaymailm.com', 'sharklasers.com', 'armyspy.com',
      'wegwerfemail.de', 'tempmail.net', 'getnada.com'
    ];
    
    return disposableDomains.includes(domain);
  }

  /**
   * Check for potential spambots based on user behavior
   * 
   * @param {Object} userData - User data to analyze
   * @returns {Object} Spam risk assessment
   */
  assessSpamRisk(userData) {
    if (!userData) {
      return {
        riskScore: 0,
        riskFactors: [],
        isLikelySpam: false
      };
    }
    
    const riskFactors = [];
    let riskScore = 0;
    
    // Check for suspicious patterns
    if (userData.email && this.isDisposableEmail(userData.email)) {
      riskFactors.push('disposable_email');
      riskScore += 25;
    }
    
    if (userData.bio && /http|www|\[url\]/i.test(userData.bio)) {
      riskFactors.push('links_in_bio');
      riskScore += 15;
    }
    
    if (userData.creationTimestamp) {
      const accountAge = Date.now() - userData.creationTimestamp;
      const hoursSinceCreation = accountAge / (1000 * 60 * 60);
      
      if (hoursSinceCreation < 24 && userData.postCount > 10) {
        riskFactors.push('high_post_rate_new_account');
        riskScore += 30;
      }
    }
    
    if (userData.postCount > 0 && userData.likes === 0) {
      riskFactors.push('no_engagement');
      riskScore += 10;
    }
    
    return {
      riskScore,
      riskFactors,
      isLikelySpam: riskScore >= 50
    };
  }

  /**
   * Apply content restrictions based on user age
   * 
   * @param {Object} content - Content to filter
   * @param {number} userAge - User age in years
   * @returns {Object} Filtered content
   */
  applyAgeBasedContentRestrictions(content, userAge) {
    if (!content) return { restricted: true };
    
    // Default to most restrictive if age unknown
    if (!userAge) return { ...content, restricted: true };
    
    // Basic age-based filtering
    if (userAge < 13) {
      // Children under 13 - most restrictive
      return {
        ...content,
        restricted: content.adultContent || content.sensitiveContent || content.violentContent,
        sensitiveTopicsFiltered: true
      };
    } else if (userAge < 18) {
      // Teens 13-17
      return {
        ...content,
        restricted: content.adultContent || content.violentContent,
        sensitiveTopicsFiltered: content.sensitiveContent
      };
    }
    
    // Adults 18+
    return {
      ...content,
      restricted: false,
      sensitiveTopicsFiltered: false
    };
  }

  /**
   * Create audit log entry for sensitive actions
   * 
   * @param {string} userId - User ID
   * @param {string} action - Action performed
   * @param {Object} details - Action details
   * @returns {Promise<boolean>} Success status
   */
  async createAuditLog(userId, action, details) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      if (!action) {
        throw new Error('Action is required');
      }
      
      await firestore().collection('auditLogs').add({
        userId,
        action,
        details: details || {},
        timestamp: firestore.FieldValue.serverTimestamp(),
        ipAddress: '',  // Would need to be captured from backend
        userAgent: Platform.OS + ' App',
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error creating audit log:', error);
      return false;
    }
  }

  /**
   * Get authenticated user's security level
   * 
   * @returns {Promise<number>} Security level (0-3)
   */
  async getUserSecurityLevel() {
    try {
      const user = auth().currentUser;
      if (!user) return 0;
      
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      if (!userDoc.exists) return 0;
      
      // Get user role
      const userData = userDoc.data();
      
      // Security levels:
      // 0 - Unauthenticated
      // 1 - Basic user
      // 2 - Verified user
      // 3 - Admin/Moderator
      
      if (userData.role === 'admin' || userData.role === 'moderator') {
        return 3;
      } else if (userData.verified) {
        return 2;
      } else {
        return 1;
      }
    } catch (error) {
      console.error('Error getting user security level:', error);
      return 0;
    }
  }

  /**
   * Check if user has permission for an action
   * 
   * @param {string} action - Action to check
   * @param {Object} resource - Resource being acted upon
   * @returns {Promise<boolean>} Whether user has permission
   */
  async hasPermission(action, resource) {
    try {
      const user = auth().currentUser;
      if (!user) return false;
      
      const securityLevel = await this.getUserSecurityLevel();
      
      // Define permission rules
      const permissionRules = {
        'post.create': { minLevel: 1 },
        'post.edit': { minLevel: 1, ownerOnly: true },
        'post.delete': { minLevel: 1, ownerOnly: true },
        'comment.create': { minLevel: 1 },
        'comment.edit': { minLevel: 1, ownerOnly: true },
        'comment.delete': { minLevel: 1, ownerOnly: true },
        'comment.moderate': { minLevel: 3 },
        'user.view': { minLevel: 1 },
        'user.edit': { minLevel: 1, ownerOnly: true },
        'user.delete': { minLevel: 1, ownerOnly: true },
        'user.block': { minLevel: 1 },
        'user.moderate': { minLevel: 3 },
        'admin.access': { minLevel: 3 },
      };
      
      const rule = permissionRules[action];
      if (!rule) return false;
      
      // Check minimum security level
      if (securityLevel < rule.minLevel) return false;
      
      // Check if action requires resource ownership
      if (rule.ownerOnly && resource && resource.userId !== user.uid) {
        // Admins/moderators (level 3) can override ownership requirement
        return securityLevel >= 3;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }
}

// Create singleton instance
const securityUtils = new SecurityUtils();

export default securityUtils;
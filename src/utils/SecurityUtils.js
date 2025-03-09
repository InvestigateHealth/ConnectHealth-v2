// src/utils/SecurityUtils.js
// Utilities for security and privacy

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNKeychain from 'react-native-keychain'; // Renamed import to avoid confusion
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { sanitizeInput } from './validationUtils';
import NetInfo from '@react-native-community/netinfo';

// Use safe require for optional dependencies
let CryptoJS = null;
try {
  CryptoJS = require('crypto-js');
} catch (err) {
  console.warn('CryptoJS not available, some security features will be limited');
}

// Disposable email domains list
const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com', 'trashmail.com', 'guerrillamail.com', 
  'tempmail.com', '10minutemail.com', 'yopmail.com',
  'disposablemail.com', 'mailnesia.com', 'mailcatch.com',
  'temp-mail.org', 'spamgourmet.com', 'dispostable.com',
  'mintemail.com', 'mailnull.com', 'mytrashmail.com',
  'throwawaymailm.com', 'sharklasers.com', 'armyspy.com',
  'wegwerfemail.de', 'tempmail.net', 'getnada.com'
];

/**
 * Security utilities for encryption, data sanitization, and privacy features
 */
class SecurityUtils {
  constructor() {
    // Initialize encryption key
    this.encryptionKey = null;
    this.encryptionAvailable = !!CryptoJS;
    this.isConnected = true;
    
    // Try to initialize key on startup
    this.initializeEncryptionKey();
    this.initNetworkListener();
  }

  /**
   * Initialize network connectivity listener
   */
  initNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isConnected = state.isConnected;
    });
  }

  /**
   * Initialize encryption key from secure storage
   */
  async initializeEncryptionKey() {
    if (!this.encryptionAvailable) {
      console.warn('Encryption is not available due to missing CryptoJS');
      return;
    }

    try {
      // Try to get from keychain (most secure)
      let key = await this.getSecureKey();
      
      if (key) {
        this.encryptionKey = key;
        return;
      }
      
      // Generate a new key if not found
      console.log('Generating new encryption key');
      key = this.generateSecureRandomString(32);
      
      // Save the new key
      await this.saveSecureKey(key);
      this.encryptionKey = key;
    } catch (error) {
      console.error('Error initializing encryption key:', error);
      // Will fall back to generating a key when needed
    }
  }

  /**
   * Get encryption key from secure storage
   * 
   * @returns {Promise<string|null>} Encryption key or null
   */
  async getSecureKey() {
    try {
      // Try keychain first (more secure)
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        try {
          const credentials = await RNKeychain.getGenericPassword({
            service: 'deviceEncryptionKey'
          });
          
          if (credentials && credentials.password) {
            return credentials.password;
          }
        } catch (keychainError) {
          console.warn('Keychain error, falling back to AsyncStorage:', keychainError);
        }
      }
      
      // Fall back to AsyncStorage, but only as a last resort
      const storageKey = await AsyncStorage.getItem('deviceEncryptionKey');
      if (storageKey) {
        // If we found a key in AsyncStorage, try to migrate it to Keychain
        if ((Platform.OS === 'ios' || Platform.OS === 'android') && RNKeychain) {
          try {
            await RNKeychain.setGenericPassword('deviceEncryptionKey', storageKey, {
              service: 'deviceEncryptionKey',
              accessible: RNKeychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
            });
            
            // After successful migration, remove from AsyncStorage
            await AsyncStorage.removeItem('deviceEncryptionKey');
          } catch (migrationError) {
            console.warn('Failed to migrate encryption key to Keychain:', migrationError);
          }
        }
        
        return storageKey;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting secure key:', error);
      return null;
    }
  }

  /**
   * Save encryption key to secure storage
   * 
   * @param {string} key - Key to save
   * @returns {Promise<boolean>} Success status
   */
  async saveSecureKey(key) {
    try {
      if (!key) return false;
      
      // Try to use keychain (most secure)
      if ((Platform.OS === 'ios' || Platform.OS === 'android') && RNKeychain) {
        try {
          await RNKeychain.setGenericPassword('deviceEncryptionKey', key, {
            service: 'deviceEncryptionKey',
            accessible: RNKeychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
          });
          return true;
        } catch (keychainError) {
          console.warn('Failed to save to Keychain, falling back to AsyncStorage:', keychainError);
        }
      }
      
      // Fall back to AsyncStorage
      await AsyncStorage.setItem('deviceEncryptionKey', key);
      return true;
    } catch (error) {
      console.error('Error saving secure key:', error);
      return false;
    }
  }

  /**
   * Encrypt sensitive data
   * 
   * @param {string|object} data - Data to encrypt
   * @returns {Promise<string|null>} Encrypted data or null
   */
  async encryptData(data) {
    if (!this.encryptionAvailable || !CryptoJS) {
      console.warn('Encryption not available. Data will not be encrypted!');
      return typeof data === 'string' ? data : JSON.stringify(data);
    }

    try {
      // Convert object to string if needed
      const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
      
      // Make sure we have an encryption key
      if (!this.encryptionKey) {
        this.encryptionKey = await this.getSecureKey();
        
        if (!this.encryptionKey) {
          this.encryptionKey = this.generateSecureRandomString(32);
          await this.saveSecureKey(this.encryptionKey);
        }
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
   * @returns {Promise<string|object|null>} Decrypted data
   */
  async decryptData(encryptedData) {
    if (!this.encryptionAvailable || !CryptoJS) {
      console.warn('Decryption not available. Returning data as-is!');
      try {
        return JSON.parse(encryptedData);
      } catch {
        return encryptedData;
      }
    }

    try {
      if (!encryptedData) {
        return null;
      }

      // Make sure we have an encryption key
      if (!this.encryptionKey) {
        this.encryptionKey = await this.getSecureKey();
        
        if (!this.encryptionKey) {
          console.error('No encryption key available for decryption');
          return null;
        }
      }
      
      // Decrypt the data
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedText) {
        console.warn('Decryption resulted in empty string');
        return null;
      }
      
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
      if ((Platform.OS === 'ios' || Platform.OS === 'android') && RNKeychain) {
        try {
          const stringValue = typeof data === 'object' ? JSON.stringify(data) : String(data);
          await RNKeychain.setGenericPassword(key, stringValue, { service: key });
          return true;
        } catch (keychainError) {
          console.warn('Keychain error, falling back to encrypted storage:', keychainError);
        }
      }
      
      // Fallback to encrypted AsyncStorage
      const encryptedData = await this.encryptData(data);
      if (encryptedData) {
        await AsyncStorage.setItem(key, encryptedData);
        return true;
      }
      return false;
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
      if ((Platform.OS === 'ios' || Platform.OS === 'android') && RNKeychain) {
        try {
          const credentials = await RNKeychain.getGenericPassword({ service: key });
          
          if (credentials) {
            // Try to parse as JSON if possible
            try {
              return JSON.parse(credentials.password);
            } catch {
              return credentials.password;
            }
          }
        } catch (keychainError) {
          console.warn('Keychain error, falling back to encrypted storage:', keychainError);
        }
      }
      
      // Fallback to encrypted AsyncStorage
      const encryptedData = await AsyncStorage.getItem(key);
      if (!encryptedData) return null;
      return await this.decryptData(encryptedData);
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
      
      let success = false;
      
      if ((Platform.OS === 'ios' || Platform.OS === 'android') && RNKeychain) {
        try {
          await RNKeychain.resetGenericPassword({ service: key });
          success = true;
        } catch (keychainError) {
          console.warn('Keychain error during removal:', keychainError);
        }
      }
      
      // Also try to remove from AsyncStorage
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing secure data:', error);
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
    if (!this.encryptionAvailable || !CryptoJS) {
      // Fallback to less secure but functional random string generation
      let result = '';
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const charactersLength = characters.length;
      
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }
      
      return result;
    }
    
    // Ensure length is at least 8 and at most 64
    const safeLength = Math.max(8, Math.min(length, 64));
    return CryptoJS.lib.WordArray.random(Math.ceil(safeLength / 2)).toString();
  }

  /**
   * Sanitize input to prevent XSS
   * (Using the utility from validationUtils to avoid duplication)
   * 
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    return sanitizeInput(input);
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
   * Check if email domain is from disposable email provider
   * 
   * @param {string} email - Email to check
   * @returns {boolean} Whether email is from disposable provider
   */
  isDisposableEmail(email) {
    if (!email || !email.includes('@')) return false;
    
    const domain = email.split('@')[1].toLowerCase();
    
    // Use imported list or fallback to a minimal set
    const disposableDomains = DISPOSABLE_EMAIL_DOMAINS || [
      'mailinator.com', 'trashmail.com', 'guerrillamail.com', 
      'tempmail.com', '10minutemail.com', 'yopmail.com'
    ];
    
    return disposableDomains.includes(domain);
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
      
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        // Store report locally to submit later
        const pendingReports = JSON.parse(await AsyncStorage.getItem('pendingReports') || '[]');
        pendingReports.push({
          contentType,
          contentId,
          reporterId,
          reason: this.sanitizeInput(reason || ''),
          timestamp: Date.now()
        });
        await AsyncStorage.setItem('pendingReports', JSON.stringify(pendingReports));
        return true;
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

  /**
   * Create an audit log entry
   * 
   * @param {string} userId - User ID
   * @param {string} action - Action performed
   * @param {Object} details - Additional details
   * @returns {Promise<boolean>} Success status
   */
  async createAuditLog(userId, action, details = {}) {
    try {
      if (!userId || !action) {
        throw new Error('User ID and action are required');
      }
      
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        // Store audit log locally to sync later
        const pendingLogs = JSON.parse(await AsyncStorage.getItem('pendingAuditLogs') || '[]');
        pendingLogs.push({
          userId,
          action,
          details,
          timestamp: Date.now(),
          userAgent: Platform.OS
        });
        await AsyncStorage.setItem('pendingAuditLogs', JSON.stringify(pendingLogs));
        return true;
      }
      
      await firestore().collection('auditLogs').add({
        userId,
        action,
        details,
        timestamp: firestore.FieldValue.serverTimestamp(),
        ipAddress: 'client-side', // Note: real IP should be added server-side
        userAgent: Platform.OS
      });
      
      return true;
    } catch (error) {
      console.error('Error creating audit log:', error);
      return false;
    }
  }
}

// Export a singleton instance for use throughout the app
const securityUtils = new SecurityUtils();
export default securityUtils;
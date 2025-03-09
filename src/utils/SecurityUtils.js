// src/utils/SecurityUtils.js
// Improved utilities for security and privacy

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNKeychain from 'react-native-keychain'; // Renamed import to avoid confusion
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { sanitizeInput } from './validationUtils';
import NetInfo from '@react-native-community/netinfo';
import crypto from 'crypto-js';

// DISPOSABLE_EMAIL_DOMAINS list - expanded with more domains
const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com', 'trashmail.com', 'guerrillamail.com', 
  'tempmail.com', '10minutemail.com', 'yopmail.com',
  'disposablemail.com', 'mailnesia.com', 'mailcatch.com',
  'temp-mail.org', 'spamgourmet.com', 'dispostable.com',
  'mintemail.com', 'mailnull.com', 'mytrashmail.com',
  'throwawaymailm.com', 'sharklasers.com', 'armyspy.com',
  'wegwerfemail.de', 'tempmail.net', 'getnada.com',
  'mailbox.org', 'maildrop.cc', 'getairmail.com', 
  'mailexpire.com', 'momentmail.com', 'emailsensei.com',
  'tempinbox.com', 'throwawaymail.com', 'discard.email',
  'temp-mail.ru', 'temp-mail.com', 'tempemail.net'
];

/**
 * Security utilities for encryption, data sanitization, and privacy features
 * Improved with better entropy generation, modern APIs, and secure storage
 */
class SecurityUtils {
  constructor() {
    // Initialize encryption key
    this.encryptionKey = null;
    this.encryptionAvailable = true;
    this.isConnected = true;
    this.initialized = false;
    this.keychainAvailable = false;
    
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
   * Improved with better fallback strategy and entropy generation
   */
  async initializeEncryptionKey() {
    try {
      // Check if keychain is available
      this.keychainAvailable = await this.isKeychainAvailable();
      
      // Try to get from keychain (most secure)
      let key = await this.getSecureKey();
      
      if (key) {
        this.encryptionKey = key;
        this.initialized = true;
        return;
      }
      
      // Generate a new key with high entropy
      console.log('Generating new encryption key');
      key = this.generateSecureRandomString(32);
      
      // Save the new key
      await this.saveSecureKey(key);
      this.encryptionKey = key;
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing encryption key:', error);
      // Will fall back to generating a key when needed
      this.initialized = false;
    }
  }

  /**
   * Check if keychain is available on this device
   * @returns {Promise<boolean>} Whether keychain is available
   */
  async isKeychainAvailable() {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      return false;
    }
    
    try {
      // Try to set a test value
      const testResult = await RNKeychain.setGenericPassword(
        'test_user',
        'test_password',
        {
          service: 'test_service',
          accessible: RNKeychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
        }
      );
      
      // Try to retrieve it
      const credentials = await RNKeychain.getGenericPassword({
        service: 'test_service'
      });
      
      // Clean up test value
      await RNKeychain.resetGenericPassword({ service: 'test_service' });
      
      return Boolean(testResult && credentials);
    } catch (error) {
      console.warn('Keychain is not available:', error);
      return false;
    }
  }

  /**
   * Get encryption key from secure storage
   * Improved with better error handling and fallback mechanisms
   * 
   * @returns {Promise<string|null>} Encryption key or null
   */
  async getSecureKey() {
    try {
      // Try keychain first (more secure)
      if (this.keychainAvailable) {
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
      
      // Fall back to AsyncStorage with additional safety checks
      const storageKey = await AsyncStorage.getItem('deviceEncryptionKey');
      if (storageKey && storageKey.length >= 16) {
        // Verify key format to ensure it's valid
        if (!/^[A-Za-z0-9+/=]+$/.test(storageKey)) {
          console.warn('Retrieved encryption key appears to be invalid');
          return null;
        }
        
        // If we found a key in AsyncStorage and keychain is available, try to migrate it
        if (this.keychainAvailable) {
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
   * Improved with better error handling and retries
   * 
   * @param {string} key - Key to save
   * @returns {Promise<boolean>} Success status
   */
  async saveSecureKey(key) {
    try {
      if (!key || key.length < 16) {
        console.error('Invalid encryption key');
        return false;
      }
      
      // Try to use keychain (most secure)
      if (this.keychainAvailable) {
        try {
          const result = await RNKeychain.setGenericPassword('deviceEncryptionKey', key, {
            service: 'deviceEncryptionKey',
            accessible: RNKeychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
          });
          
          if (result) {
            return true;
          } else {
            console.warn('Keychain returned no result, falling back to AsyncStorage');
          }
        } catch (keychainError) {
          console.warn('Failed to save to Keychain, falling back to AsyncStorage:', keychainError);
        }
      }
      
      // Fall back to AsyncStorage with safety confirmation
      try {
        await AsyncStorage.setItem('deviceEncryptionKey', key);
        
        // Verify storage succeeded
        const verification = await AsyncStorage.getItem('deviceEncryptionKey');
        if (verification !== key) {
          throw new Error('Storage verification failed');
        }
        
        return true;
      } catch (asyncStorageError) {
        console.error('Error saving to AsyncStorage:', asyncStorageError);
        return false;
      }
    } catch (error) {
      console.error('Error saving secure key:', error);
      return false;
    }
  }

  /**
   * Encrypt sensitive data
   * Improved with better error handling and initialization checks
   * 
   * @param {string|object} data - Data to encrypt
   * @returns {Promise<string|null>} Encrypted data or null
   */
  async encryptData(data) {
    if (!this.initialized) {
      // Try to initialize again if not already done
      await this.initializeEncryptionKey();
      
      if (!this.initialized) {
        console.warn('Encryption not initialized. Data will not be encrypted!');
        return typeof data === 'string' ? data : JSON.stringify(data);
      }
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
      
      // Encrypt the data with improved algorithm
      // Use AES with CBC mode and a random IV for better security
      const iv = crypto.lib.WordArray.random(16);
      const encrypted = crypto.AES.encrypt(dataString, this.encryptionKey, {
        iv: iv,
        mode: crypto.mode.CBC,
        padding: crypto.pad.Pkcs7
      });
      
      // Combine IV and ciphertext for storage
      return iv.toString() + encrypted.toString();
    } catch (error) {
      console.error('Encryption error:', error);
      return null;
    }
  }

  /**
   * Decrypt encrypted data
   * Improved with better error handling and format validation
   * 
   * @param {string} encryptedData - Encrypted data to decrypt
   * @returns {Promise<string|object|null>} Decrypted data
   */
  async decryptData(encryptedData) {
    if (!this.initialized) {
      // Try to initialize again if not already done
      await this.initializeEncryptionKey();
      
      if (!this.initialized) {
        console.warn('Decryption not initialized. Returning data as-is!');
        try {
          return JSON.parse(encryptedData);
        } catch {
          return encryptedData;
        }
      }
    }

    try {
      if (!encryptedData) {
        return null;
      }
      
      // Validate that encryptedData is a string and has expected format
      if (typeof encryptedData !== 'string' || encryptedData.length < 32) {
        console.warn('Invalid encrypted data format');
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
      
      try {
        // Extract IV (first 32 characters) and ciphertext
        const iv = crypto.enc.Hex.parse(encryptedData.substring(0, 32));
        const ciphertext = encryptedData.substring(32);
        
        // Decrypt the data
        const decryptedBytes = crypto.AES.decrypt(ciphertext, this.encryptionKey, {
          iv: iv,
          mode: crypto.mode.CBC,
          padding: crypto.pad.Pkcs7
        });
        
        const decryptedText = decryptedBytes.toString(crypto.enc.Utf8);
        
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
      } catch (cryptoError) {
        // Handle invalid ciphertext format
        console.error('Failed to decrypt data, may be using old format:', cryptoError);
        
        // Try with old format (without IV)
        try {
          const decryptedBytes = crypto.AES.decrypt(encryptedData, this.encryptionKey);
          const decryptedText = decryptedBytes.toString(crypto.enc.Utf8);
          
          if (!decryptedText) {
            console.warn('Legacy decryption resulted in empty string');
            return null;
          }
          
          // Try to parse as JSON, return as string if not valid JSON
          try {
            return JSON.parse(decryptedText);
          } catch {
            return decryptedText;
          }
        } catch (legacyError) {
          console.error('Legacy decryption failed:', legacyError);
          return null;
        }
      }
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  /**
   * Store sensitive data securely
   * Improved with better security considerations
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
      
      // For sensitive information, use keychain when available
      if (this.keychainAvailable) {
        try {
          const stringValue = typeof data === 'object' ? JSON.stringify(data) : String(data);
          await RNKeychain.setGenericPassword(key, stringValue, { 
            service: key,
            accessible: RNKeychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
          });
          return true;
        } catch (keychainError) {
          console.warn('Keychain error, falling back to encrypted storage:', keychainError);
        }
      }
      
      // Fallback to encrypted AsyncStorage
      const encryptedData = await this.encryptData(data);
      if (encryptedData) {
        await AsyncStorage.setItem(`encrypted_${key}`, encryptedData);
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
   * Improved with better error handling and format validation
   * 
   * @param {string} key - Storage key
   * @returns {Promise<any>} Retrieved data
   */
  async getSecureData(key) {
    try {
      if (!key) {
        throw new Error('Storage key is required');
      }
      
      // For sensitive information, try keychain first when available
      if (this.keychainAvailable) {
        try {
          const credentials = await RNKeychain.getGenericPassword({ service: key });
          
          if (credentials && credentials.password) {
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
      const encryptedData = await AsyncStorage.getItem(`encrypted_${key}`);
      if (!encryptedData) return null;
      
      return await this.decryptData(encryptedData);
    } catch (error) {
      console.error('Error retrieving secure data:', error);
      return null;
    }
  }

  /**
   * Remove secure data
   * Improved with comprehensive cleanup
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
      
      // Try to remove from keychain
      if (this.keychainAvailable) {
        try {
          await RNKeychain.resetGenericPassword({ service: key });
          success = true;
        } catch (keychainError) {
          console.warn('Keychain error during removal:', keychainError);
        }
      }
      
      // Also try to remove from AsyncStorage (both encrypted and unencrypted versions)
      try {
        await AsyncStorage.multiRemove([key, `encrypted_${key}`]);
        success = true;
      } catch (asyncStorageError) {
        console.error('AsyncStorage error during removal:', asyncStorageError);
      }
      
      return success;
    } catch (error) {
      console.error('Error removing secure data:', error);
      return false;
    }
  }

  /**
   * Generate a secure random string with high entropy
   * Significantly improved with better entropy sources
   * 
   * @param {number} length - Length of the string
   * @returns {string} Random string
   */
  generateSecureRandomString(length = 16) {
    try {
      // Ensure length is at least 16 and at most 64
      const safeLength = Math.max(16, Math.min(length, 64));
      
      // Generate random bytes with high entropy
      let randomBytes;
      
      // Use the most secure method available
      randomBytes = crypto.lib.WordArray.random(Math.ceil(safeLength / 2));
      
      // Convert to a string suitable for use as a key
      return randomBytes.toString(crypto.enc.Base64).slice(0, safeLength);
    } catch (error) {
      console.error('Error generating secure random string:', error);
      
      // Fallback to less secure but functional random string generation
      let result = '';
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=+';
      const charactersLength = characters.length;
      
      // Mix in timestamp for additional entropy
      const timestamp = Date.now().toString();
      result += timestamp.substring(timestamp.length - 4);
      
      // Fill the rest with random characters
      for (let i = result.length; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }
      
      return result;
    }
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
   * Improved with better validation
   * 
   * @param {string} url - URL to sanitize
   * @returns {string|null} Sanitized URL or null if invalid
   */
  sanitizeURL(url) {
    if (!url) return null;
    
    // Trim whitespace
    url = url.trim();
    
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
      
      // Check for suspicious patterns
      const domain = parsedURL.hostname.toLowerCase();
      const path = parsedURL.pathname.toLowerCase();
      
      // List of suspicious patterns in URLs
      const suspiciousPatterns = [
        /\.(exe|dll|bat|sh|cmd|msi|vbs|ps1)$/i, // Executable extensions
        /^data:/i, // Data URLs
        /^javascript:/i, // JavaScript URLs
        /^vbscript:/i, // VBScript URLs
        /^file:/i, // File URLs
      ];
      
      // Check for suspicious patterns
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(url)) {
          return null;
        }
      }
      
      return parsedURL.toString();
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if email domain is from disposable email provider
   * Improved with better matching algorithm
   * 
   * @param {string} email - Email to check
   * @returns {boolean} Whether email is from disposable provider
   */
  isDisposableEmail(email) {
    if (!email || !email.includes('@')) return false;
    
    // Extract the domain part
    const domain = email.split('@')[1].toLowerCase();
    
    // Check exact matches
    if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
      return true;
    }
    
    // Check for subdomains of known disposable providers
    for (const disposableDomain of DISPOSABLE_EMAIL_DOMAINS) {
      if (domain.endsWith(`.${disposableDomain}`)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Redact sensitive information from text
   * Improved with more comprehensive patterns and better handling
   * 
   * @param {string} text - Text to redact
   * @returns {string} Redacted text
   */
  redactSensitiveInfo(text) {
    if (!text) return '';
    
    // Patterns for common sensitive information
    const patterns = {
      // Credit card numbers (improved pattern)
      creditCard: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
      // Social Security Numbers (improved pattern with optional dashes)
      ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      // Email addresses
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      // Phone numbers (improved pattern for international formats)
      phone: /\b(?:\+?\d{1,3}[-\s.]?)?\(?(?:\d{2,3})\)?[-\s.]?(?:\d{2,4})[-\s.]?(?:\d{2,4})[-\s.]?(?:\d{2,4})\b/g,
      // Street addresses (improved pattern)
      address: /\b\d+\s+[A-Za-z\s,]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|plaza|square|sq|parkway|pkwy|circle|cir|highway|hwy)\b/gi,
      // Passport numbers (basic patterns for US/UK/Canada)
      passport: /\b[A-Z]{1,2}[0-9]{6,9}\b/g,
      // Bank account numbers (generic pattern)
      bankAccount: /\b\d{8,17}\b/g,
    };
    
    let redactedText = text;
    
    // Apply each redaction pattern
    for (const [type, pattern] of Object.entries(patterns)) {
      redactedText = redactedText.replace(pattern, match => {
        if (type === 'email') {
          // Keep domain for emails
          const parts = match.split('@');
          if (parts.length === 2) {
            return '***@' + parts[1];
          }
          return '***@***';
        } else if (type === 'creditCard') {
          // Keep last 4 digits for credit cards
          return '****-****-****-' + match.replace(/\D/g, '').slice(-4);
        } else if (type === 'phone') {
          // Keep last 4 digits for phone numbers
          const digits = match.replace(/\D/g, '');
          return '(***) ***-' + digits.slice(-4);
        } else if (type === 'ssn') {
          // Use standard SSN redaction format
          return '***-**-' + match.replace(/\D/g, '').slice(-4);
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
   * Improved with better error handling and data validation
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
      
      // Validate content type
      const validContentTypes = ['post', 'comment', 'user', 'message', 'profile'];
      if (!validContentTypes.includes(contentType)) {
        throw new Error('Invalid content type');
      }
      
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        // Store report locally to submit later
        try {
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
        } catch (storageError) {
          console.error('Error storing pending report:', storageError);
          throw new Error('Failed to save report. Please try again when online.');
        }
      }
      
      const sanitizedReason = this.sanitizeInput(reason || '');
      
      // Create the report in Firestore
      const reportData = {
        contentType,
        contentId,
        reporterId,
        reason: sanitizedReason,
        timestamp: firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        platform: Platform.OS,
        appVersion: require('../../package.json').version,
      };
      
      await firestore().collection('reports').add(reportData);
      
      // Also update a counter on the reported content to flag for review
      // if multiple reports are received
      try {
        const contentRef = firestore().collection(contentType + 's').doc(contentId);
        await contentRef.update({
          reportCount: firestore.FieldValue.increment(1),
          lastReportedAt: firestore.FieldValue.serverTimestamp()
        });
      } catch (updateError) {
        console.warn('Error updating report count on content:', updateError);
        // Continue since the report was still created
      }
      
      return true;
    } catch (error) {
      console.error('Error reporting inappropriate content:', error);
      throw error;
    }
  }

  /**
   * Check for potential spambots based on user behavior
   * Improved with more sophisticated detection
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
    
    // Check for links in bio/profile
    if (userData.bio && /https?:\/\/|www\.|[a-z0-9](\.[a-z0-9])+/i.test(userData.bio)) {
      riskFactors.push('links_in_bio');
      riskScore += 15;
    }
    
    // Check for high post rate for new accounts
    if (userData.createdAt || userData.creationTimestamp) {
      const creationTime = userData.createdAt?.toMillis?.() || 
                           userData.creationTimestamp || 
                           Date.now();
      const accountAge = Date.now() - creationTime;
      const hoursSinceCreation = accountAge / (1000 * 60 * 60);
      
      // New account with many posts
      if (hoursSinceCreation < 24 && userData.postCount > 10) {
        riskFactors.push('high_post_rate_new_account');
        riskScore += 30;
      }
      
      // Extremely high post rate
      const postsPerHour = userData.postCount / Math.max(1, hoursSinceCreation);
      if (postsPerHour > 5) {
        riskFactors.push('excessive_posting_rate');
        riskScore += 20;
      }
    }
    
    // Check for no engagement on posts
    if (userData.postCount > 5 && userData.totalLikesReceived === 0) {
      riskFactors.push('no_engagement');
      riskScore += 15;
    }
    
    // Check for repetitive content
    if (userData.postSimilarityScore && userData.postSimilarityScore > 0.9) {
      riskFactors.push('repetitive_content');
      riskScore += 25;
    }
    
    // Check for suspicious username patterns
    if (userData.username && /^[a-z0-9]+\d{4,}$/i.test(userData.username)) {
      riskFactors.push('bot_like_username');
      riskScore += 10;
    }
    
    // Multiple reports from other users
    if (userData.reportCount && userData.reportCount > 3) {
      riskFactors.push('multiple_user_reports');
      riskScore += 20;
    }
    
    return {
      riskScore,
      riskFactors,
      isLikelySpam: riskScore >= 50,
      requiresReview: riskScore >= 30
    };
  }

  /**
   * Get authenticated user's security level
   * Improved with caching for better performance
   * 
   * @returns {Promise<number>} Security level (0-3)
   */
  async getUserSecurityLevel() {
    try {
      const user = auth().currentUser;
      if (!user) return 0;
      
      // Check for cached security level first
      try {
        const cachedLevel = await AsyncStorage.getItem(`securityLevel_${user.uid}`);
        if (cachedLevel && !isNaN(parseInt(cachedLevel))) {
          // Only use cache if it's recent (within last hour)
          const cacheTimestamp = await AsyncStorage.getItem(`securityLevelTimestamp_${user.uid}`);
          if (cacheTimestamp && (Date.now() - parseInt(cacheTimestamp)) < 60 * 60 * 1000) {
            return parseInt(cachedLevel);
          }
        }
      } catch (cacheError) {
        console.warn('Error reading cached security level:', cacheError);
      }
      
      // Get fresh data from Firestore
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      if (!userDoc.exists) return 0;
      
      // Get user role
      const userData = userDoc.data();
      
      // Security levels:
      // 0 - Unauthenticated
      // 1 - Basic user
      // 2 - Verified user
      // 3 - Admin/Moderator
      
      let securityLevel = 1; // Default for authenticated users
      
      if (userData.role === 'admin' || userData.role === 'moderator') {
        securityLevel = 3;
      } else if (userData.verified) {
        securityLevel = 2;
      }
      
      // Cache the result
      try {
        await AsyncStorage.setItem(`securityLevel_${user.uid}`, securityLevel.toString());
        await AsyncStorage.setItem(`securityLevelTimestamp_${user.uid}`, Date.now().toString());
      } catch (cacheError) {
        console.warn('Error caching security level:', cacheError);
      }
      
      return securityLevel;
    } catch (error) {
      console.error('Error getting user security level:', error);
      return 0;
    }
  }

  /**
   * Check if user has permission for an action
   * Improved with better role-based access control
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
      
      // Define permission rules with more granular control
      const permissionRules = {
        // Post related permissions
        'post.create': { minLevel: 1 },
        'post.edit': { minLevel: 1, ownerOnly: true },
        'post.delete': { minLevel: 1, ownerOnly: true },
        'post.report': { minLevel: 1 },
        'post.view': { minLevel: 1 },
        'post.moderate': { minLevel: 3 },
        
        // Comment related permissions
        'comment.create': { minLevel: 1 },
        'comment.edit': { minLevel: 1, ownerOnly: true },
        'comment.delete': { minLevel: 1, ownerOnly: true },
        'comment.report': { minLevel: 1 },
        'comment.moderate': { minLevel: 3 },
        
        // User profile related permissions
        'user.view': { minLevel: 1 },
        'user.edit': { minLevel: 1, ownerOnly: true },
        'user.delete': { minLevel: 1, ownerOnly: true },
        'user.block': { minLevel: 1 },
        'user.report': { minLevel: 1 },
        'user.moderate': { minLevel: 3 },
        
        // Medical data permissions (sensitive)
        'medical.view': { minLevel: 1, ownerOnly: true },
        'medical.edit': { minLevel: 1, ownerOnly: true },
        'medical.share': { minLevel: 1, ownerOnly: true },
        
        // Administrative actions
        'admin.access': { minLevel: 3 },
        'admin.users': { minLevel: 3 },
        'admin.reports': { minLevel: 3 },
        'admin.settings': { minLevel: 3 },
      };
      
      const rule = permissionRules[action];
      if (!rule) return false;
      
      // Check minimum security level
      if (securityLevel < rule.minLevel) return false;
      
      // Check if action requires resource ownership
      if (rule.ownerOnly && resource) {
        // Check various owner ID fields that might be present
        const resourceOwnerId = resource.userId || resource.ownerId || resource.createdBy || resource.authorId;
        
        if (resourceOwnerId !== user.uid) {
          // Admins/moderators (level 3) can override ownership requirement
          return securityLevel >= 3;
        }
      }
      
      // Specific blocking checks
      if (action.startsWith('post.') || action.startsWith('comment.')) {
        // Check if user is blocked by content owner
        const contentOwnerId = resource?.userId || resource?.authorId || resource?.createdBy;
        
        if (contentOwnerId && contentOwnerId !== user.uid) {
          try {
            const blockDoc = await firestore()
              .collection('userBlocks')
              .where('blockedBy', '==', contentOwnerId)
              .where('blockedUser', '==', user.uid)
              .limit(1)
              .get();
              
            if (!blockDoc.empty) {
              // User is blocked, deny permission
              return false;
            }
          } catch (blockError) {
            console.warn('Error checking block status:', blockError);
            // Continue with permission check
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Create an audit log entry
   * Improved with better offline support and retry mechanism
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
      
      // Sanitize details to prevent malicious data
      const sanitizedDetails = {};
      Object.keys(details || {}).forEach(key => {
        if (typeof details[key] === 'string') {
          sanitizedDetails[key] = this.sanitizeInput(details[key]);
        } else if (
          details[key] === null || 
          typeof details[key] === 'number' || 
          typeof details[key] === 'boolean'
        ) {
          sanitizedDetails[key] = details[key];
        } else if (typeof details[key] === 'object') {
          // Convert objects to strings to avoid nested objects
          sanitizedDetails[key] = JSON.stringify(details[key]);
        }
      });
      
      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        // Store audit log locally to sync later
        try {
          const pendingLogs = JSON.parse(await AsyncStorage.getItem('pendingAuditLogs') || '[]');
          
          // Prevent duplicate logs
          const isDuplicate = pendingLogs.some(log => 
            log.userId === userId && 
            log.action === action && 
            Date.now() - log.timestamp < 10000 // Within last 10 seconds
          );
          
          if (!isDuplicate) {
            pendingLogs.push({
              userId,
              action,
              details: sanitizedDetails,
              timestamp: Date.now(),
              userAgent: Platform.OS,
              appVersion: require('../../package.json').version
            });
            
            await AsyncStorage.setItem('pendingAuditLogs', JSON.stringify(pendingLogs));
          }
          return true;
        } catch (storageError) {
          console.error('Error storing pending audit log:', storageError);
          return false;
        }
      }
      
      // Create the audit log in Firestore
      await firestore().collection('auditLogs').add({
        userId,
        action,
        details: sanitizedDetails,
        timestamp: firestore.FieldValue.serverTimestamp(),
        ipAddress: 'client-side', // Note: real IP should be added server-side
        userAgent: Platform.OS,
        appVersion: require('../../package.json').version
      });
      
      return true;
    } catch (error) {
      console.error('Error creating audit log:', error);
      
      // Save failed logs for retry
      try {
        const failedLogs = JSON.parse(await AsyncStorage.getItem('failedAuditLogs') || '[]');
        failedLogs.push({
          userId,
          action,
          details,
          timestamp: Date.now(),
          error: error.message,
          retryCount: 0
        });
        await AsyncStorage.setItem('failedAuditLogs', JSON.stringify(failedLogs));
      } catch (storageError) {
        console.error('Error saving failed audit log:', storageError);
      }
      
      return false;
    }
  }
  
  /**
   * Sync pending audit logs when back online
   * New method to handle retry mechanism
   * 
   * @returns {Promise<boolean>} Success status
   */
  async syncPendingAuditLogs() {
    if (!this.isConnected) return false;
    
    try {
      // Get pending logs
      const pendingLogs = JSON.parse(await AsyncStorage.getItem('pendingAuditLogs') || '[]');
      if (pendingLogs.length === 0) return true;
      
      // Get failed logs for retry
      const failedLogs = JSON.parse(await AsyncStorage.getItem('failedAuditLogs') || '[]');
      
      // Combine logs that are ready for retry
      const retryLogs = failedLogs.filter(log => {
        const hoursPassed = (Date.now() - log.timestamp) / (1000 * 60 * 60);
        const retryDelay = Math.min(24, Math.pow(2, log.retryCount)); // Exponential backoff
        return hoursPassed >= retryDelay;
      });
      
      const allLogs = [...pendingLogs, ...retryLogs];
      if (allLogs.length === 0) return true;
      
      // Use batched writes for efficiency
      const db = firestore();
      let successCount = 0;
      let batch = db.batch();
      let batchCount = 0;
      const maxBatchSize = 500; // Firestore batch limit
      
      for (const log of allLogs) {
        try {
          const docRef = db.collection('auditLogs').doc();
          
          batch.set(docRef, {
            userId: log.userId,
            action: log.action,
            details: log.details || {},
            timestamp: log.timestamp ? firestore.Timestamp.fromMillis(log.timestamp) : firestore.FieldValue.serverTimestamp(),
            syncedFromOffline: true,
            userAgent: log.userAgent || Platform.OS,
            appVersion: log.appVersion || require('../../package.json').version
          });
          
          batchCount++;
          successCount++;
          
          // Commit batch when it reaches max size
          if (batchCount >= maxBatchSize) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        } catch (error) {
          console.error('Error preparing audit log batch:', error);
        }
      }
      
      // Commit remaining batch operations
      if (batchCount > 0) {
        await batch.commit();
      }
      
      // Clear pending logs
      await AsyncStorage.setItem('pendingAuditLogs', JSON.stringify([]));
      
      // Update failed logs by removing successful ones and incrementing retry count
      const updatedFailedLogs = failedLogs.filter(log => {
        const wasRetried = retryLogs.some(rl => 
          rl.userId === log.userId && 
          rl.action === log.action && 
          rl.timestamp === log.timestamp
        );
        
        return !wasRetried;
      });
      
      await AsyncStorage.setItem('failedAuditLogs', JSON.stringify(updatedFailedLogs));
      
      return successCount > 0;
    } catch (error) {
      console.error('Error syncing audit logs:', error);
      return false;
    }
  }
  
  /**
   * Block a user to prevent interactions
   * New method for user blocking functionality
   * 
   * @param {string} userToBlock - User ID to block
   * @returns {Promise<boolean>} Success status
   */
  async blockUser(userToBlock) {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser || !userToBlock) {
        throw new Error('Authentication required and valid user ID to block');
      }
      
      if (currentUser.uid === userToBlock) {
        throw new Error('Cannot block yourself');
      }
      
      // Check if already blocked
      const blockQuery = await firestore()
        .collection('userBlocks')
        .where('blockedBy', '==', currentUser.uid)
        .where('blockedUser', '==', userToBlock)
        .limit(1)
        .get();
        
      if (!blockQuery.empty) {
        // Already blocked
        return true;
      }
      
      // Create block document
      await firestore().collection('userBlocks').add({
        blockedBy: currentUser.uid,
        blockedUser: userToBlock,
        createdAt: firestore.FieldValue.serverTimestamp(),
        reason: null
      });
      
      // Also update current user's blockedUsers array for quicker client-side checking
      await firestore().collection('users').doc(currentUser.uid).update({
        blockedUsers: firestore.FieldValue.arrayUnion(userToBlock)
      });
      
      // Create audit log
      await this.createAuditLog(
        currentUser.uid,
        'user_blocked',
        { blockedUser: userToBlock }
      );
      
      return true;
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  }
  
  /**
   * Unblock a previously blocked user
   * New method to complement blocking functionality
   * 
   * @param {string} userToUnblock - User ID to unblock
   * @returns {Promise<boolean>} Success status
   */
  async unblockUser(userToUnblock) {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser || !userToUnblock) {
        throw new Error('Authentication required and valid user ID to unblock');
      }
      
      // Find block document
      const blockQuery = await firestore()
        .collection('userBlocks')
        .where('blockedBy', '==', currentUser.uid)
        .where('blockedUser', '==', userToUnblock)
        .limit(1)
        .get();
        
      if (blockQuery.empty) {
        // Not blocked, nothing to do
        return true;
      }
      
      // Delete block document
      const batch = firestore().batch();
      blockQuery.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Update current user's blockedUsers array
      const userRef = firestore().collection('users').doc(currentUser.uid);
      batch.update(userRef, {
        blockedUsers: firestore.FieldValue.arrayRemove(userToUnblock)
      });
      
      await batch.commit();
      
      // Create audit log
      await this.createAuditLog(
        currentUser.uid,
        'user_unblocked',
        { unblockedUser: userToUnblock }
      );
      
      return true;
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  }
  
  /**
   * Check if a user is blocked by another user
   * New method to check block status
   * 
   * @param {string} blockedBy - User ID who might have blocked
   * @param {string} potentiallyBlockedUser - User ID to check if blocked
   * @returns {Promise<boolean>} Whether user is blocked
   */
  async isUserBlocked(blockedBy, potentiallyBlockedUser) {
    try {
      if (!blockedBy || !potentiallyBlockedUser) {
        return false;
      }
      
      // Check local cache first
      try {
        const cachedBlocks = await AsyncStorage.getItem(`userBlocks_${blockedBy}`);
        if (cachedBlocks) {
          const blockedUsers = JSON.parse(cachedBlocks);
          if (Array.isArray(blockedUsers) && 
              blockedUsers.includes(potentiallyBlockedUser)) {
            return true;
          }
        }
      } catch (cacheError) {
        console.warn('Error checking cached blocks:', cacheError);
      }
      
      // Query Firestore
      const blockQuery = await firestore()
        .collection('userBlocks')
        .where('blockedBy', '==', blockedBy)
        .where('blockedUser', '==', potentiallyBlockedUser)
        .limit(1)
        .get();
        
      return !blockQuery.empty;
    } catch (error) {
      console.error('Error checking block status:', error);
      return false;
    }
  }
}

// Export a singleton instance for use throughout the app
const securityUtils = new SecurityUtils();
export default securityUtils;
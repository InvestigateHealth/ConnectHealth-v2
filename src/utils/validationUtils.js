export const validateFileType = (mimeType, allowedTypes) => {
  if (!mimeType) {
    return {
      isValid: false,
      message: 'File type could not be determined'
    };
  }

  // Normalize MIME type to lowercase
  const normalizedMimeType = mimeType.toLowerCase();
  
  // Normalize allowed types to lowercase
  const normalizedAllowedTypes = allowedTypes.map(type => type.toLowerCase());
  
  if (!normalizedAllowedTypes.includes(normalizedMimeType)) {
    // Create user-friendly type list (remove the MIME prefix)
    const formattedTypes = normalizedAllowedTypes.map(type => {
      const parts = type.split('/');
      if (parts.length === 2) {
        if (parts[0] === 'image') return parts[1].toUpperCase();
        if (parts[0] === 'video') return `${parts[1].toUpperCase()} video`;
        if (parts[0] === 'audio') return `${parts[1].toUpperCase()} audio`;
      }
      return type;
    });
    
    // Join with commas and 'or'
    let typeList = '';
    if (formattedTypes.length === 1) {
      typeList = formattedTypes[0];
    } else if (formattedTypes.length === 2) {
      typeList = `${formattedTypes[0]} or ${formattedTypes[1]}`;
    } else {
      const lastType = formattedTypes.pop();
      typeList = `${formattedTypes.join(', ')}, or ${lastType}`;
    }
    
    return {
      isValid: false,
      message: `File type not supported. Allowed types: ${typeList}`,
      providedType: normalizedMimeType,
      allowedTypes: normalizedAllowedTypes
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate image file type with expanded formats
 * 
 * @param {string} mimeType - Image MIME type
 * @returns {Object} Validation result with isValid and message
 */
export const validateImageType = (mimeType) => {
  const allowedTypes = [
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/webp', 
    'image/heic', 
    'image/heif',
    'image/svg+xml',
    'image/bmp',
    'image/tiff'
  ];
  
  return validateFileType(mimeType, allowedTypes);
};

/**
 * Validate video file type with expanded formats
 * 
 * @param {string} mimeType - Video MIME type
 * @returns {Object} Validation result with isValid and message
 */
export const validateVideoType = (mimeType) => {
  const allowedTypes = [
    'video/mp4', 
    'video/quicktime', 
    'video/x-msvideo', 
    'video/x-ms-wmv', 
    'video/webm', 
    'video/ogg',
    'video/mpeg',
    'video/3gpp',
    'video/x-flv',
    'video/x-matroska'
  ];
  
  return validateFileType(mimeType, allowedTypes);
};

/**
 * Validate phone number format with international support
 * Uses libphonenumber for robust international validation
 * 
 * @param {string} phone - Phone number to validate
 * @param {string} countryCode - Country code (ISO 3166-1 alpha-2)
 * @param {boolean} required - Whether the phone is required
 * @returns {Object} Validation result with isValid and message
 */
export const validatePhone = (phone, countryCode = 'US', required = false) => {
  if (!phone && required) {
    return {
      isValid: false,
      message: 'Phone number is required'
    };
  }
  
  if (!phone && !required) {
    return {
      isValid: true,
      message: ''
    };
  }
  
  try {
    // Parse and validate the phone number
    const phoneNumber = phoneUtil.parseAndKeepRawInput(phone, countryCode);
    const isValid = phoneUtil.isValidNumber(phoneNumber);
    
    if (!isValid) {
      return {
        isValid: false,
        message: 'Please enter a valid phone number'
      };
    }
    
    // Get the formatted version for consistency
    const formattedNumber = phoneUtil.format(phoneNumber, libphonenumber.PhoneNumberFormat.INTERNATIONAL);
    
    return {
      isValid: true,
      message: '',
      formattedNumber
    };
  } catch (error) {
    return {
      isValid: false,
      message: 'Please enter a valid phone number'
    };
  }
};

/**
 * Validate username format with improved rules
 * 
 * @param {string} username - Username to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid and message
 */
export const validateUsername = (username, options = {}) => {
  const {
    minLength = 3,
    maxLength = 30,
    allowUnderscores = true,
    allowDots = true,
    allowHyphens = false,
    allowNumbers = true,
    checkReserved = true
  } = options;
  
  if (!username || !username.trim()) {
    return {
      isValid: false,
      message: 'Username is required'
    };
  }
  
  // Check length
  if (username.length < minLength) {
    return {
      isValid: false,
      message: `Username must be at least ${minLength} characters long`
    };
  }
  
  if (username.length > maxLength) {
    return {
      isValid: false,
      message: `Username cannot exceed ${maxLength} characters`
    };
  }
  
  // Build regex based on options
  let regexPattern = '^[a-zA-Z';
  if (allowNumbers) regexPattern += '0-9';
  if (allowUnderscores) regexPattern += '_';
  if (allowDots) regexPattern += '\\.';
  if (allowHyphens) regexPattern += '\\-';
  regexPattern += ']+// src/utils/validationUtils.js
// Improved validation utilities for forms and data

import { Platform } from 'react-native';
import libphonenumber from 'google-libphonenumber'; // For robust phone validation

// Initialize phone number util
const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

// Custom email regex with support for international domains and Unicode
const EMAIL_REGEX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF-][a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF0-9-]*[a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF0-9]\.)+[a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]{2,}))$/;

// Improved URL regex that handles international domains
const URL_REGEX = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/i;

/**
 * Validate email format with better support for international domains
 * 
 * @param {string} email - Email to validate
 * @param {boolean} required - Whether email is required
 * @returns {Object} Validation result with isValid and message
 */
export const validateEmail = (email, required = true) => {
  if (!email || !email.trim()) {
    return {
      isValid: !required,
      message: required ? 'Email is required' : ''
    };
  }

  // Normalize email (trim and lowercase)
  const normalizedEmail = email.trim().toLowerCase();
  
  // Check format using regex
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return {
      isValid: false,
      message: 'Please enter a valid email address'
    };
  }
  
  // Additional checks
  // Check for common typos in domains
  const domain = normalizedEmail.split('@')[1];
  const commonTypos = {
    'gmail.co': 'gmail.com',
    'gmail.vom': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmail.con': 'gmail.com',
    'gmial.com': 'gmail.com',
    'hotmail.co': 'hotmail.com',
    'hormail.com': 'hotmail.com',
    'hotmail.con': 'hotmail.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'yaho.co': 'yahoo.com',
    'outloo.com': 'outlook.com',
    'outlok.com': 'outlook.com'
  };
  
  if (commonTypos[domain]) {
    return {
      isValid: false,
      message: `Did you mean ${normalizedEmail.split('@')[0]}@${commonTypos[domain]}?`,
      suggestedFix: `${normalizedEmail.split('@')[0]}@${commonTypos[domain]}`
    };
  }

  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate password strength
 * Updated to follow NIST 800-63B guidelines
 * 
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid and message
 */
export const validatePassword = (password, options = {}) => {
  const {
    minLength = 8,
    checkCommonPasswords = true,
    required = true
  } = options;

  if (!password) {
    return {
      isValid: !required,
      message: required ? 'Password is required' : ''
    };
  }

  // Check minimum length (NIST recommends at least 8 characters)
  if (password.length < minLength) {
    return {
      isValid: false,
      message: `Password must be at least ${minLength} characters long`,
      strengthScore: 0
    };
  }
  
  // Calculate password strength score (0-4)
  let strengthScore = 0;
  
  // Length contribution
  if (password.length >= 12) {
    strengthScore += 1;
  }
  
  // Character variety contribution
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const varietyScore = 
    (hasUppercase ? 1 : 0) + 
    (hasLowercase ? 1 : 0) + 
    (hasNumbers ? 1 : 0) + 
    (hasSpecialChars ? 1 : 0);
    
  // Add variety score (max 2 points)
  strengthScore += Math.min(2, varietyScore * 0.5);
  
  // Length variety score
  if (password.length >= 14 && varietyScore >= 3) {
    strengthScore += 1;
  }
  
  // Check for common passwords (if enabled)
  if (checkCommonPasswords) {
    // List of the top 20 most common passwords
    const commonPasswords = [
      '123456', 'password', '12345678', 'qwerty', '123456789',
      '12345', '1234', '111111', '1234567', 'dragon',
      '123123', 'baseball', 'abc123', 'football', 'monkey',
      'letmein', '696969', 'shadow', 'master', '666666'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      return {
        isValid: false,
        message: 'This password is too common and easily guessed',
        strengthScore: 0
      };
    }
    
    // Check for simple patterns
    if (/^(1234|4321|abcd|qwerty|asdf)/.test(password.toLowerCase()) ||
        /(\d)\1{3,}/.test(password) || // Repeated digits
        /(.)\1{3,}/.test(password)) {  // Repeated characters
      return {
        isValid: false,
        message: 'Password contains a simple pattern and could be easily guessed',
        strengthScore: Math.max(0, strengthScore - 1)
      };
    }
  }
  
  // Feedback based on strength score
  let feedback = '';
  
  if (strengthScore < 2) {
    feedback = 'Consider using a longer password with a mix of character types';
  }
  
  return {
    isValid: true,
    message: feedback,
    strengthScore: strengthScore,
    hasUppercase,
    hasLowercase,
    hasNumbers,
    hasSpecialChars
  };
};

/**
 * Validate password confirmation
 * 
 * @param {string} password - Password to check
 * @param {string} confirmPassword - Confirmation password to validate
 * @returns {Object} Validation result with isValid and message
 */
export const validatePasswordConfirmation = (password, confirmPassword) => {
  if (!confirmPassword) {
    return {
      isValid: false,
      message: 'Please confirm your password'
    };
  }

  if (password !== confirmPassword) {
    return {
      isValid: false,
      message: 'Passwords do not match'
    };
  }

  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate name input with improved international support
 * 
 * @param {string} name - Name to validate
 * @param {string} fieldName - Name of the field (e.g., 'First name', 'Last name')
 * @param {boolean} required - Whether the field is required
 * @returns {Object} Validation result with isValid and message
 */
export const validateName = (name, fieldName = 'Name', required = true) => {
  if (!name || !name.trim()) {
    return {
      isValid: !required,
      message: required ? `${fieldName} is required` : ''
    };
  }

  // Improved regex allowing international characters
  // Includes Latin, Greek, Cyrillic, CJK, and other common scripts
  const nameRegex = /^[\p{L}\p{M}'\-\s.]+$/u;
  
  if (!nameRegex.test(name)) {
    return {
      isValid: false,
      message: `${fieldName} contains invalid characters`
    };
  }
  
  // Check for minimum meaningful length
  if (name.trim().length < 2) {
    return {
      isValid: false,
      message: `${fieldName} is too short`
    };
  }

  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate URL format with improved international domain support
 * 
 * @param {string} url - URL to validate
 * @param {boolean} required - Whether the URL is required
 * @returns {Object} Validation result with isValid and message
 */
export const validateUrl = (url, required = false) => {
  if (!url && required) {
    return {
      isValid: false,
      message: 'URL is required'
    };
  }

  if (!url && !required) {
    return {
      isValid: true,
      message: ''
    };
  }
  
  // Trim whitespace
  url = url.trim();

  // Try to create a URL object - this validates the URL format
  try {
    // Add protocol if missing
    let testUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      testUrl = 'https://' + url;
    }
    
    new URL(testUrl);
    
    // Additional check using regex for more validation
    if (!URL_REGEX.test(testUrl)) {
      return {
        isValid: false,
        message: 'Please enter a valid URL'
      };
    }
    
    return {
      isValid: true,
      message: '',
      formattedUrl: testUrl // Return the URL with protocol
    };
  } catch (e) {
    return {
      isValid: false,
      message: 'Please enter a valid URL'
    };
  }
};

/**
 * Format URL with proper protocol
 * 
 * @param {string} url - URL to format
 * @returns {string} Formatted URL
 */
export const formatUrl = (url) => {
  if (!url) return '';
  
  // Trim whitespace
  url = url.trim();
  
  // Add https:// if no protocol specified
  if (!/^https?:\/\//i.test(url)) {
    return 'https://' + url;
  }
  
  return url;
};

/**
 * Extract domain from URL with improved handling
 * 
 * @param {string} url - URL to process
 * @returns {string} Domain name
 */
export const extractDomain = (url) => {
  try {
    if (!url) return '';
    
    const formatted = formatUrl(url);
    const urlObj = new URL(formatted);
    
    // Get hostname and remove www if present
    let domain = urlObj.hostname;
    
    // Handle internationalized domain names
    if (domain.startsWith('xn--')) {
      try {
        // Attempt to decode Punycode
        const punycode = require('punycode');
        domain = punycode.decode(domain.replace('xn--', ''));
      } catch (error) {
        // Continue with encoded domain if punycode fails
        console.warn('Failed to decode internationalized domain name:', error);
      }
    }
    
    return domain.replace(/^www\./, '');
  } catch (e) {
    // Return original if parsing fails
    return url ? url.trim() : '';
  }
};

/**
 * Validate social media link with improved platform detection
 * 
 * @param {string} url - Social media URL to validate
 * @param {string} platform - Platform to validate for (optional)
 * @returns {Object} Validation result with status and sanitized URL
 */
export const validateSocialMediaLink = (url, platform = null) => {
  if (!url) return { isValid: false, url: null };
  
  // Trim input
  url = url.trim();
  
  // Add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  
  // Try to parse the URL
  try {
    const parsedURL = new URL(url);
    const hostname = parsedURL.hostname.toLowerCase();
    
    // Define allowed domains based on platform with more comprehensive list
    const allowedDomains = {
      facebook: ['facebook.com', 'www.facebook.com', 'fb.com', 'm.facebook.com', 'facebook.me'],
      instagram: ['instagram.com', 'www.instagram.com', 'instagr.am'],
      linkedin: ['linkedin.com', 'www.linkedin.com', 'lnkd.in'],
      twitter: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com', 't.co'],
      substack: ['substack.com', '*.substack.com'],
      tiktok: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
      youtube: ['youtube.com', 'www.youtube.com', 'youtu.be', 'yt.be'],
      medium: ['medium.com', '*.medium.com'],
      reddit: ['reddit.com', 'www.reddit.com', 'redd.it'],
      github: ['github.com', 'www.github.com', 'gist.github.com'],
      snapchat: ['snapchat.com', 'www.snapchat.com'],
      pinterest: ['pinterest.com', 'www.pinterest.com', 'pin.it'],
      whatsapp: ['whatsapp.com', 'www.whatsapp.com', 'wa.me'],
      telegram: ['t.me', 'telegram.me', 'telegram.org'],
      discord: ['discord.gg', 'discord.com', 'discordapp.com'],
      twitch: ['twitch.tv', 'www.twitch.tv'],
      vimeo: ['vimeo.com', 'www.vimeo.com'],
      patreon: ['patreon.com', 'www.patreon.com'],
      threads: ['threads.net', 'www.threads.net'],
      mastodon: ['mastodon.social', '*.mastodon.social'],
    };
    
    // Check if specific platform was requested
    if (platform) {
      const platformKey = platform.toLowerCase();
      if (!allowedDomains[platformKey]) {
        return {
          isValid: false,
          url: null,
          message: `Unsupported platform: ${platform}`
        };
      }
      
      // Check domain match, including wildcards
      const isValid = allowedDomains[platformKey].some(domain => {
        if (domain.startsWith('*.')) {
          return hostname.endsWith(domain.substring(1));
        }
        return hostname === domain || hostname.endsWith('.' + domain);
      });
      
      if (!isValid) {
        return {
          isValid: false,
          url: null,
          message: `This doesn't appear to be a valid ${platform} URL`
        };
      }
      
      // Normalize URL for specific platforms
      let normalizedUrl = parsedURL.toString();
      
      // Platform-specific URL normalization
      if (platformKey === 'twitter' || platformKey === 'x') {
        // Remove query parameters from Twitter URLs except for specific ones
        const username = parsedURL.pathname.split('/')[1];
        
        if (username && !['search', 'hashtag', 'explore'].includes(username)) {
          // It's a profile URL, keep it clean
          normalizedUrl = `https://twitter.com/${username}`;
        }
      } else if (platformKey === 'instagram') {
        // Clean Instagram URLs
        const username = parsedURL.pathname.split('/')[1];
        
        if (username && username !== 'p' && username !== 'explore') {
          // It's a profile URL
          normalizedUrl = `https://instagram.com/${username}`;
        }
      }
      
      return {
        isValid: true,
        url: normalizedUrl,
        platform: platformKey
      };
    }
    
    // Check all platforms
    for (const [platformName, domains] of Object.entries(allowedDomains)) {
      const isMatch = domains.some(domain => {
        if (domain.startsWith('*.')) {
          return hostname.endsWith(domain.substring(1));
        }
        return hostname === domain || hostname.endsWith('.' + domain);
      });
      
      if (isMatch) {
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
    return { 
      isValid: false, 
      url: null,
      message: 'Invalid URL format'
    };
  }
};

/**
 * Validate post content with improved checks
 * 
 * @param {Object} post - Post data to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validatePost = (post) => {
  const errors = {};
  
  if (!post) {
    errors.general = 'Post data is required';
    return {
      isValid: false,
      errors
    };
  }
  
  // Validate post type
  if (!post.type || !['text', 'image', 'video', 'link', 'poll'].includes(post.type)) {
    errors.type = 'Invalid post type';
  }
  
  // Validate caption/text based on post type
  if (post.type === 'text') {
    if (!post.text && !post.caption) {
      errors.text = 'Text is required for text posts';
    } else if ((post.text || post.caption || '').length > 5000) {
      errors.text = 'Text is too long (maximum 5000 characters)';
    }
  } else if ((post.type === 'image' || post.type === 'video') && !post.caption && !post.text) {
    // Caption is optional for media posts, but validate length if provided
    if (post.caption && post.caption.length > 2000) {
      errors.caption = 'Caption is too long (maximum 2000 characters)';
    }
  }
  
  // Validate image for image posts
  if (post.type === 'image' && !post.imageUri && !post.content && !post.images) {
    errors.image = 'Please select an image';
  }
  
  // Validate video for video posts
  if (post.type === 'video' && !post.videoUri && !post.content) {
    errors.video = 'Please select a video';
  }
  
  // Validate URL for link posts
  if (post.type === 'link') {
    const urlValidation = validateUrl(post.linkUrl, true);
    if (!urlValidation.isValid) {
      errors.linkUrl = urlValidation.message || 'Please enter a valid URL';
    }
  }
  
  // Validate poll options if it's a poll
  if (post.type === 'poll') {
    if (!post.pollOptions || !Array.isArray(post.pollOptions) || post.pollOptions.length < 2) {
      errors.pollOptions = 'Please provide at least 2 poll options';
    } else {
      // Check if any poll option is empty
      const hasEmptyOption = post.pollOptions.some(option => !option || !option.trim());
      if (hasEmptyOption) {
        errors.pollOptions = 'Poll options cannot be empty';
      }
    }
  }
  
  // Check for potentially sensitive content
  if (post.text || post.caption) {
    const content = (post.text || post.caption).toLowerCase();
    const sensitivePatterns = [
      /\b(suicide|kill\s*(?:my|your)self|die)\b/i,
      /\b(cocaine|heroin|meth|marijuana|weed)\b/i
    ];
    
    for (const pattern of sensitivePatterns) {
      if (pattern.test(content)) {
        if (!errors.warnings) errors.warnings = [];
        errors.warnings.push('This post may contain sensitive content');
        break;
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).filter(key => key !== 'warnings').length === 0,
    errors,
    warnings: errors.warnings
  };
};

/**
 * Validate comment text with improved checks
 * 
 * @param {string} text - Comment text to validate
 * @returns {Object} Validation result with isValid and message
 */
export const validateComment = (text) => {
  if (!text || !text.trim()) {
    return {
      isValid: false,
      message: 'Comment cannot be empty'
    };
  }
  
  const trimmedText = text.trim();
  
  if (trimmedText.length < 1) {
    return {
      isValid: false,
      message: 'Comment is too short'
    };
  }
  
  if (trimmedText.length > 1000) {
    return {
      isValid: false,
      message: 'Comment is too long (maximum 1000 characters)'
    };
  }
  
  // Check for spam patterns
  const spamPatterns = [
    /(\S+)\1{4,}/i, // Repeated words
    /(https?:\/\/\S+\s+){3,}/i, // Multiple URLs
    /([A-Z]{5,}\s*){3,}/ // ALL CAPS SHOUTING
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(trimmedText)) {
      return {
        isValid: false,
        message: 'This comment appears to be spam or promotional content'
      };
    }
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate file size with improved handling
 * 
 * @param {number} fileSize - File size in bytes
 * @param {number} maxSize - Maximum allowed size in MB
 * @returns {Object} Validation result with isValid and message
 */
export const validateFileSize = (fileSize, maxSize) => {
  if (!fileSize && fileSize !== 0) {
    return {
      isValid: false,
      message: 'File size is unknown'
    };
  }
  
  const maxSizeInBytes = maxSize * 1024 * 1024;
  
  if (fileSize > maxSizeInBytes) {
    // Format size for better readability
    const formattedMaxSize = maxSize >= 1 ? `${maxSize} MB` : `${maxSize * 1024} KB`;
    
    return {
      isValid: false,
      message: `File size exceeds maximum allowed size of ${formattedMaxSize}`,
      actualSize: fileSize,
      maxSize: maxSizeInBytes
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate image dimensions with improved aspects
 * 
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid and message
 */
export const validateImageDimensions = (width, height, options = {}) => {
  if (!width || !height) {
    return {
      isValid: false,
      message: 'Image dimensions are required'
    };
  }
  
  const {
    minWidth = 0,
    minHeight = 0,
    maxWidth = 5000,
    maxHeight = 5000,
    aspectRatio = null,
    aspectRatioTolerance = 0.1
  } = options;
  
  // Check minimum dimensions
  if (width < minWidth || height < minHeight) {
    return {
      isValid: false,
      message: `Image is too small (minimum ${minWidth}x${minHeight} pixels)`
    };
  }
  
  // Check maximum dimensions
  if (width > maxWidth || height > maxHeight) {
    return {
      isValid: false,
      message: `Image is too large (maximum ${maxWidth}x${maxHeight} pixels)`
    };
  }
  
  // Check aspect ratio if specified
  if (aspectRatio !== null) {
    const imageRatio = width / height;
    const minRatio = aspectRatio - aspectRatioTolerance;
    const maxRatio = aspectRatio + aspectRatioTolerance;
    
    if (imageRatio < minRatio || imageRatio > maxRatio) {
      // Format the expected ratio for display
      let ratioText = '';
      if (aspectRatio === 1) {
        ratioText = 'square (1:1)';
      } else if (aspectRatio === 16/9) {
        ratioText = '16:9';
      } else if (aspectRatio === 4/3) {
        ratioText = '4:3';
      } else if (aspectRatio === 3/2) {
        ratioText = '3:2';
      } else {
        ratioText = aspectRatio.toFixed(2);
      }
      
      return {
        isValid: false,
        message: `Image aspect ratio should be approximately ${ratioText}`,
        actualRatio: imageRatio,
        expectedRatio: aspectRatio
      };
    }
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate video duration with improved feedback
 * 
 * @param {number} duration - Video duration in milliseconds
 * @param {number} maxDuration - Maximum allowed duration in seconds
 * @param {number} minDuration - Minimum allowed duration in seconds
 * @returns {Object} Validation result with isValid and message
 */
export const validateVideoDuration = (duration, maxDuration, minDuration = 1) => {
  if (!duration && duration !== 0) {
    return {
      isValid: false,
      message: 'Video duration is unknown'
    };
  }
  
  const durationInSeconds = duration / 1000;
  
  if (durationInSeconds < minDuration) {
    return {
      isValid: false,
      message: `Video is too short (minimum ${minDuration} second${minDuration !== 1 ? 's' : ''})`,
      actualDuration: durationInSeconds,
      minDuration: minDuration
    };
  }
  
  if (durationInSeconds > maxDuration) {
    // Format duration for better readability
    const formattedMaxDuration = maxDuration >= 60 
      ? `${Math.floor(maxDuration / 60)} minute${Math.floor(maxDuration / 60) !== 1 ? 's' : ''} ${maxDuration % 60 ? `${maxDuration % 60} seconds` : ''}`
      : `${maxDuration} seconds`;
    
    return {
      isValid: false,
      message: `Video duration exceeds maximum allowed duration of ${formattedMaxDuration}`,
      actualDuration: durationInSeconds,
      maxDuration: maxDuration
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate file type with improved MIME type handling
 * 
 * @param {string} mimeType - File MIME type
 * @param {Array<string>} allowedTypes - Array of allowed MIME types
 * @returns {Object} Validation result with isValid and message
 */;
  
  const usernameRegex = new RegExp(regexPattern);
  
  if (!usernameRegex.test(username)) {
    let allowedChars = 'letters';
    if (allowNumbers) allowedChars += ', numbers';
    if (allowUnderscores) allowedChars += ', underscores';
    if (allowDots) allowedChars += ', periods';
    if (allowHyphens) allowedChars += ', hyphens';
    
    return {
      isValid: false,
      message: `Username can only contain ${allowedChars}`
    };
  }
  
  // Check for reserved usernames
  if (checkReserved) {
    const reservedUsernames = [
      'admin', 'administrator', 'support', 'user', 'helpdesk',
      'moderator', 'mod', 'official', 'staff', 'team', 'info',
      'account', 'billing', 'donate', 'donation', 'help',
      'contact', 'security', 'system', 'root', 'abuse',
      'webmaster', 'postmaster', 'hostmaster', 'anonymous'
    ];
    
    if (reservedUsernames.includes(username.toLowerCase())) {
      return {
        isValid: false,
        message: 'This username is reserved and not available'
      };
    }
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate date with expanded options
 * 
 * @param {Date|string} date - Date to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid and message
 */
export const validateDate = (date, options = {}) => {
  const {
    required = false,
    minDate = null,
    maxDate = null,
    allowFutureDate = true,
    format = null
  } = options;
  
  if (!date && required) {
    return {
      isValid: false,
      message: 'Date is required'
    };
  }
  
  if (!date && !required) {
    return {
      isValid: true,
      message: ''
    };
  }
  
  // Convert to Date object if string
  let dateObj;
  if (typeof date === 'string') {
    // If a specific format is provided, use it to parse
    if (format) {
      try {
        const dateFns = require('date-fns');
        dateObj = dateFns.parse(date, format, new Date());
      } catch (error) {
        dateObj = new Date(date);
      }
    } else {
      dateObj = new Date(date);
    }
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    return {
      isValid: false,
      message: 'Invalid date format'
    };
  }
  
  // Check if valid date
  if (isNaN(dateObj.getTime())) {
    return {
      isValid: false,
      message: 'Please enter a valid date'
    };
  }
  
  // Check future date constraint
  if (!allowFutureDate && dateObj > new Date()) {
    return {
      isValid: false,
      message: 'Date cannot be in the future'
    };
  }
  
  // Check min date
  if (minDate) {
    const minDateObj = minDate instanceof Date ? minDate : new Date(minDate);
    if (dateObj < minDateObj) {
      return {
        isValid: false,
        message: `Date must be on or after ${minDateObj.toLocaleDateString()}`
      };
    }
  }
  
  // Check max date
  if (maxDate) {
    const maxDateObj = maxDate instanceof Date ? maxDate : new Date(maxDate);
    if (dateObj > maxDateObj) {
      return {
        isValid: false,
        message: `Date must be on or before ${maxDateObj.toLocaleDateString()}`
      };
    }
  }
  
  return {
    isValid: true,
    message: '',
    date: dateObj
  };
};

/**
 * Validate user profile data with comprehensive checks
 * 
 * @param {Object} profile - Profile data to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateUserProfile = (profile) => {
  const errors = {};
  
  // Validate first name
  if (profile.firstName !== undefined) {
    const firstNameValidation = validateName(profile.firstName, 'First name');
    if (!firstNameValidation.isValid) {
      errors.firstName = firstNameValidation.message;
    }
  }
  
  // Validate last name
  if (profile.lastName !== undefined) {
    const lastNameValidation = validateName(profile.lastName, 'Last name');
    if (!lastNameValidation.isValid) {
      errors.lastName = lastNameValidation.message;
    }
  }
  
  // Validate display name
  if (profile.displayName !== undefined) {
    if (!profile.displayName || !profile.displayName.trim()) {
      errors.displayName = 'Display name is required';
    } else if (profile.displayName.length > 50) {
      errors.displayName = 'Display name cannot exceed 50 characters';
    }
  }
  
  // Validate email if provided
  if (profile.email !== undefined) {
    const emailValidation = validateEmail(profile.email);
    if (!emailValidation.isValid) {
      errors.email = emailValidation.message;
    }
  }
  
  // Validate phone if provided
  if (profile.phone !== undefined) {
    const phoneValidation = validatePhone(profile.phone, profile.countryCode || 'US', false);
    if (!phoneValidation.isValid) {
      errors.phone = phoneValidation.message;
    }
  }
  
  // Validate bio if provided
  if (profile.bio !== undefined) {
    if (profile.bio && profile.bio.length > 500) {
      errors.bio = 'Bio cannot exceed 500 characters';
    }
  }
  
  // Validate website if provided
  if (profile.website !== undefined && profile.website) {
    const websiteValidation = validateUrl(profile.website, false);
    if (!websiteValidation.isValid) {
      errors.website = websiteValidation.message;
    }
  }
  
  // Validate profile image if provided
  if (profile.profileImage !== undefined && profile.profileImage) {
    // Validate image dimension and file size would be
    // handled during image upload, not here
  }
  
  // Validate medical conditions
  if (profile.medicalConditions !== undefined) {
    if (profile.medicalConditions && !Array.isArray(profile.medicalConditions)) {
      errors.medicalConditions = 'Medical conditions must be a list';
    }
  }
  
  // Validate date of birth if provided
  if (profile.dateOfBirth !== undefined) {
    const dobValidation = validateDate(profile.dateOfBirth, {
      allowFutureDate: false,
      minDate: new Date(1900, 0, 1)
    });
    
    if (!dobValidation.isValid) {
      errors.dateOfBirth = dobValidation.message;
    }
  }
  
  // Validate gender if provided
  if (profile.gender !== undefined) {
    const validGenderValues = ['male', 'female', 'non-binary', 'prefer-not-to-say', 'other'];
    if (profile.gender && !validGenderValues.includes(profile.gender)) {
      errors.gender = 'Invalid gender value';
    }
  }
  
  // Validate social media links if provided
  if (profile.socialLinks && typeof profile.socialLinks === 'object') {
    const socialErrors = {};
    
    for (const [platform, url] of Object.entries(profile.socialLinks)) {
      if (url) {
        const validation = validateSocialMediaLink(url, platform);
        if (!validation.isValid) {
          socialErrors[platform] = validation.message || `Invalid ${platform} URL`;
        }
      }
    }
    
    if (Object.keys(socialErrors).length > 0) {
      errors.socialLinks = socialErrors;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Sanitize user input to prevent XSS with improved handling
 * 
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
export const sanitizeInput = (input) => {
  if (input === null || input === undefined) return '';
  
  if (typeof input !== 'string') {
    try {
      input = String(input);
    } catch (e) {
      return '';
    }
  }
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#x60;');
};

/**
 * Run multiple validations and combine results
 * 
 * @param {Array} validations - Array of validation objects
 * @returns {Object} Combined validation result with isValid and errors
 */
export const combineValidations = (validations) => {
  const errors = {};
  let isValid = true;
  
  for (const { field, validation } of validations) {
    if (!validation.isValid) {
      errors[field] = validation.message;
      isValid = false;
    }
  }
  
  return {
    isValid,
    errors
  };
};

/**
 * Get human-readable error message from validation errors
 * 
 * @param {Object} errors - Validation errors object
 * @returns {string} User-friendly error message
 */
export const getValidationErrorMessage = (errors) => {
  if (!errors || Object.keys(errors).length === 0) {
    return '';
  }
  
  // Handle nested error objects
  let messages = [];
  
  for (const [field, error] of Object.entries(errors)) {
    if (typeof error === 'string') {
      messages.push(error);
    } else if (typeof error === 'object' && error !== null) {
      // Handle nested errors (e.g., for social media links)
      for (const [subField, subError] of Object.entries(error)) {
        if (typeof subError === 'string') {
          messages.push(`${subField}: ${subError}`);
        }
      }
    }
  }
  
  return messages.join('\n');
};

/**
 * Check if email domain is from disposable email provider
 * (Use SecurityUtils.isDisposableEmail instead for more comprehensive check)
 * 
 * @param {string} email - Email to check
 * @returns {boolean} Whether email is from disposable provider
 */
export const isDisposableEmail = (email) => {
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
};

/**
 * Validate a credit card number using Luhn algorithm
 * 
 * @param {string} cardNumber - Credit card number to validate
 * @returns {Object} Validation result with isValid and message
 */
export const validateCreditCardNumber = (cardNumber) => {
  if (!cardNumber) {
    return {
      isValid: false,
      message: 'Credit card number is required'
    };
  }
  
  // Remove spaces, dashes, etc.
  const normalizedNumber = cardNumber.replace(/[\s-]/g, '');
  
  // Check if number contains only digits
  if (!/^\d+$/.test(normalizedNumber)) {
    return {
      isValid: false,
      message: 'Credit card number may only contain digits'
    };
  }
  
  // Check length (most cards are 13-19 digits)
  if (normalizedNumber.length < 13 || normalizedNumber.length > 19) {
    return {
      isValid: false,
      message: 'Credit card number has an invalid length'
    };
  }
  
  // Determine card type based on first digits
  let cardType = '';
  if (/^4/.test(normalizedNumber)) {
    cardType = 'Visa';
  } else if (/^5[1-5]/.test(normalizedNumber)) {
    cardType = 'Mastercard';
  } else if (/^3[47]/.test(normalizedNumber)) {
    cardType = 'American Express';
  } else if (/^6(?:011|5)/.test(normalizedNumber)) {
    cardType = 'Discover';
  } else if (/^3(?:0[0-5]|[68])/.test(normalizedNumber)) {
    cardType = 'Diners Club';
  } else if (/^(?:2131|1800|35)/.test(normalizedNumber)) {
    cardType = 'JCB';
  }
  
  // Validate using Luhn algorithm
  let sum = 0;
  let shouldDouble = false;
  
  // Loop through digits from right to left
  for (let i = normalizedNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(normalizedNumber.charAt(i));
    
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  
  const isValid = sum % 10 === 0;
  
  return {
    isValid,
    message: isValid ? '' : 'Invalid credit card number',
    cardType
  };
};

/**
 * Validate a credit card expiration date
 * 
 * @param {string|number} month - Expiration month
 * @param {string|number} year - Expiration year
 * @returns {Object} Validation result with isValid and message
 */
export const validateCreditCardExpiration = (month, year) => {
  if (!month || !year) {
    return {
      isValid: false,
      message: 'Expiration date is required'
    };
  }
  
  // Convert to numbers
  const expirationMonth = parseInt(month, 10);
  let expirationYear = parseInt(year, 10);
  
  // If year is provided as 2 digits, convert to 4 digits
  if (expirationYear < 100) {
    expirationYear += 2000;
  }
  
  // Check month validity
  if (expirationMonth < 1 || expirationMonth > 12) {
    return {
      isValid: false,
      message: 'Invalid month'
    };
  }
  
  // Get current date for comparison
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed
  const currentYear = now.getFullYear();
  
  // Check if card is expired
  if (expirationYear < currentYear || 
     (expirationYear === currentYear && expirationMonth < currentMonth)) {
    return {
      isValid: false,
      message: 'Card has expired'
    };
  }
  
  // Reasonable limit on future dates (10 years)
  if (expirationYear > currentYear + 10) {
    return {
      isValid: false,
      message: 'Expiration year too far in the future'
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate a credit card security code (CVV/CVC)
 * 
 * @param {string} securityCode - Security code to validate
 * @param {string} cardType - Card type (optional)
 * @returns {Object} Validation result with isValid and message
 */
export const validateCreditCardSecurityCode = (securityCode, cardType = '') => {
  if (!securityCode) {
    return {
      isValid: false,
      message: 'Security code is required'
    };
  }
  
  // Remove spaces
  const normalizedCode = securityCode.replace(/\s/g, '');
  
  // Check if code contains only digits
  if (!/^\d+$/.test(normalizedCode)) {
    return {
      isValid: false,
      message: 'Security code may only contain digits'
    };
  }
  
  // American Express uses 4-digit codes, all others use 3-digit codes
  const requiredLength = cardType.toLowerCase() === 'american express' ? 4 : 3;
  
  if (normalizedCode.length !== requiredLength) {
    return {
      isValid: false,
      message: `Security code must be ${requiredLength} digits`
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate a postal/zip code with international format support
 * 
 * @param {string} postalCode - Postal code to validate
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {Object} Validation result with isValid and message
 */
export const validatePostalCode = (postalCode, countryCode = 'US') => {
  if (!postalCode) {
    return {
      isValid: false,
      message: 'Postal code is required'
    };
  }
  
  // Normalize postal code and country code
  const normalizedPostalCode = postalCode.trim().toUpperCase();
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  
  // Country-specific validation patterns
  const patterns = {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/,
    UK: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/,
    AU: /^\d{4}$/,
    DE: /^\d{5}$/,
    FR: /^\d{5}$/,
    IT: /^\d{5}$/,
    ES: /^\d{5}$/,
    JP: /^\d{3}-\d{4}$/,
    CN: /^\d{6}$/,
    IN: /^\d{6}$/,
    BR: /^\d{5}-\d{3}$/,
    RU: /^\d{6}$/
  };
  
  // Default pattern for countries not specifically listed
  const defaultPattern = /^[A-Z0-9\s-]{3,10}$/;
  
  // Get the appropriate pattern
  const pattern = patterns[normalizedCountryCode] || defaultPattern;
  
  if (!pattern.test(normalizedPostalCode)) {
    return {
      isValid: false,
      message: `Invalid postal code format for ${normalizedCountryCode}`
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

// Export additional utility functions
export default {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateName,
  validateUrl,
  formatUrl,
  extractDomain,
  validateSocialMediaLink,
  validatePost,
  validateComment,
  validateFileSize,
  validateImageDimensions,
  validateVideoDuration,
  validateFileType,
  validateImageType,
  validateVideoType,
  validatePhone,
  validateUsername,
  validateDate,
  validateUserProfile,
  sanitizeInput,
  combineValidations,
  getValidationErrorMessage,
  isDisposableEmail,
  validateCreditCardNumber,
  validateCreditCardExpiration,
  validateCreditCardSecurityCode,
  validatePostalCode
};// src/utils/validationUtils.js
// Improved validation utilities for forms and data

import { Platform } from 'react-native';
import libphonenumber from 'google-libphonenumber'; // For robust phone validation

// Initialize phone number util
const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

// Custom email regex with support for international domains and Unicode
const EMAIL_REGEX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF-][a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF0-9-]*[a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF0-9]\.)+[a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]{2,}))$/;

// Improved URL regex that handles international domains
const URL_REGEX = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/i;

/**
 * Validate email format with better support for international domains
 * 
 * @param {string} email - Email to validate
 * @param {boolean} required - Whether email is required
 * @returns {Object} Validation result with isValid and message
 */
export const validateEmail = (email, required = true) => {
  if (!email || !email.trim()) {
    return {
      isValid: !required,
      message: required ? 'Email is required' : ''
    };
  }

  // Normalize email (trim and lowercase)
  const normalizedEmail = email.trim().toLowerCase();
  
  // Check format using regex
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return {
      isValid: false,
      message: 'Please enter a valid email address'
    };
  }
  
  // Additional checks
  // Check for common typos in domains
  const domain = normalizedEmail.split('@')[1];
  const commonTypos = {
    'gmail.co': 'gmail.com',
    'gmail.vom': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmail.con': 'gmail.com',
    'gmial.com': 'gmail.com',
    'hotmail.co': 'hotmail.com',
    'hormail.com': 'hotmail.com',
    'hotmail.con': 'hotmail.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'yaho.co': 'yahoo.com',
    'outloo.com': 'outlook.com',
    'outlok.com': 'outlook.com'
  };
  
  if (commonTypos[domain]) {
    return {
      isValid: false,
      message: `Did you mean ${normalizedEmail.split('@')[0]}@${commonTypos[domain]}?`,
      suggestedFix: `${normalizedEmail.split('@')[0]}@${commonTypos[domain]}`
    };
  }

  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate password strength
 * Updated to follow NIST 800-63B guidelines
 * 
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid and message
 */
export const validatePassword = (password, options = {}) => {
  const {
    minLength = 8,
    checkCommonPasswords = true,
    required = true
  } = options;

  if (!password) {
    return {
      isValid: !required,
      message: required ? 'Password is required' : ''
    };
  }

  // Check minimum length (NIST recommends at least 8 characters)
  if (password.length < minLength) {
    return {
      isValid: false,
      message: `Password must be at least ${minLength} characters long`,
      strengthScore: 0
    };
  }
  
  // Calculate password strength score (0-4)
  let strengthScore = 0;
  
  // Length contribution
  if (password.length >= 12) {
    strengthScore += 1;
  }
  
  // Character variety contribution
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const varietyScore = 
    (hasUppercase ? 1 : 0) + 
    (hasLowercase ? 1 : 0) + 
    (hasNumbers ? 1 : 0) + 
    (hasSpecialChars ? 1 : 0);
    
  // Add variety score (max 2 points)
  strengthScore += Math.min(2, varietyScore * 0.5);
  
  // Length variety score
  if (password.length >= 14 && varietyScore >= 3) {
    strengthScore += 1;
  }
  
  // Check for common passwords (if enabled)
  if (checkCommonPasswords) {
    // List of the top 20 most common passwords
    const commonPasswords = [
      '123456', 'password', '12345678', 'qwerty', '123456789',
      '12345', '1234', '111111', '1234567', 'dragon',
      '123123', 'baseball', 'abc123', 'football', 'monkey',
      'letmein', '696969', 'shadow', 'master', '666666'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      return {
        isValid: false,
        message: 'This password is too common and easily guessed',
        strengthScore: 0
      };
    }
    
    // Check for simple patterns
    if (/^(1234|4321|abcd|qwerty|asdf)/.test(password.toLowerCase()) ||
        /(\d)\1{3,}/.test(password) || // Repeated digits
        /(.)\1{3,}/.test(password)) {  // Repeated characters
      return {
        isValid: false,
        message: 'Password contains a simple pattern and could be easily guessed',
        strengthScore: Math.max(0, strengthScore - 1)
      };
    }
  }
  
  // Feedback based on strength score
  let feedback = '';
  
  if (strengthScore < 2) {
    feedback = 'Consider using a longer password with a mix of character types';
  }
  
  return {
    isValid: true,
    message: feedback,
    strengthScore: strengthScore,
    hasUppercase,
    hasLowercase,
    hasNumbers,
    hasSpecialChars
  };
};

/**
 * Validate password confirmation
 * 
 * @param {string} password - Password to check
 * @param {string} confirmPassword - Confirmation password to validate
 * @returns {Object} Validation result with isValid and message
 */
export const validatePasswordConfirmation = (password, confirmPassword) => {
  if (!confirmPassword) {
    return {
      isValid: false,
      message: 'Please confirm your password'
    };
  }

  if (password !== confirmPassword) {
    return {
      isValid: false,
      message: 'Passwords do not match'
    };
  }

  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate name input with improved international support
 * 
 * @param {string} name - Name to validate
 * @param {string} fieldName - Name of the field (e.g., 'First name', 'Last name')
 * @param {boolean} required - Whether the field is required
 * @returns {Object} Validation result with isValid and message
 */
export const validateName = (name, fieldName = 'Name', required = true) => {
  if (!name || !name.trim()) {
    return {
      isValid: !required,
      message: required ? `${fieldName} is required` : ''
    };
  }

  // Improved regex allowing international characters
  // Includes Latin, Greek, Cyrillic, CJK, and other common scripts
  const nameRegex = /^[\p{L}\p{M}'\-\s.]+$/u;
  
  if (!nameRegex.test(name)) {
    return {
      isValid: false,
      message: `${fieldName} contains invalid characters`
    };
  }
  
  // Check for minimum meaningful length
  if (name.trim().length < 2) {
    return {
      isValid: false,
      message: `${fieldName} is too short`
    };
  }

  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate URL format with improved international domain support
 * 
 * @param {string} url - URL to validate
 * @param {boolean} required - Whether the URL is required
 * @returns {Object} Validation result with isValid and message
 */
export const validateUrl = (url, required = false) => {
  if (!url && required) {
    return {
      isValid: false,
      message: 'URL is required'
    };
  }

  if (!url && !required) {
    return {
      isValid: true,
      message: ''
    };
  }
  
  // Trim whitespace
  url = url.trim();

  // Try to create a URL object - this validates the URL format
  try {
    // Add protocol if missing
    let testUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      testUrl = 'https://' + url;
    }
    
    new URL(testUrl);
    
    // Additional check using regex for more validation
    if (!URL_REGEX.test(testUrl)) {
      return {
        isValid: false,
        message: 'Please enter a valid URL'
      };
    }
    
    return {
      isValid: true,
      message: '',
      formattedUrl: testUrl // Return the URL with protocol
    };
  } catch (e) {
    return {
      isValid: false,
      message: 'Please enter a valid URL'
    };
  }
};

/**
 * Format URL with proper protocol
 * 
 * @param {string} url - URL to format
 * @returns {string} Formatted URL
 */
export const formatUrl = (url) => {
  if (!url) return '';
  
  // Trim whitespace
  url = url.trim();
  
  // Add https:// if no protocol specified
  if (!/^https?:\/\//i.test(url)) {
    return 'https://' + url;
  }
  
  return url;
};

/**
 * Extract domain from URL with improved handling
 * 
 * @param {string} url - URL to process
 * @returns {string} Domain name
 */
export const extractDomain = (url) => {
  try {
    if (!url) return '';
    
    const formatted = formatUrl(url);
    const urlObj = new URL(formatted);
    
    // Get hostname and remove www if present
    let domain = urlObj.hostname;
    
    // Handle internationalized domain names
    if (domain.startsWith('xn--')) {
      try {
        // Attempt to decode Punycode
        const punycode = require('punycode');
        domain = punycode.decode(domain.replace('xn--', ''));
      } catch (error) {
        // Continue with encoded domain if punycode fails
        console.warn('Failed to decode internationalized domain name:', error);
      }
    }
    
    return domain.replace(/^www\./, '');
  } catch (e) {
    // Return original if parsing fails
    return url ? url.trim() : '';
  }
};

/**
 * Validate social media link with improved platform detection
 * 
 * @param {string} url - Social media URL to validate
 * @param {string} platform - Platform to validate for (optional)
 * @returns {Object} Validation result with status and sanitized URL
 */
export const validateSocialMediaLink = (url, platform = null) => {
  if (!url) return { isValid: false, url: null };
  
  // Trim input
  url = url.trim();
  
  // Add protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  
  // Try to parse the URL
  try {
    const parsedURL = new URL(url);
    const hostname = parsedURL.hostname.toLowerCase();
    
    // Define allowed domains based on platform with more comprehensive list
    const allowedDomains = {
      facebook: ['facebook.com', 'www.facebook.com', 'fb.com', 'm.facebook.com', 'facebook.me'],
      instagram: ['instagram.com', 'www.instagram.com', 'instagr.am'],
      linkedin: ['linkedin.com', 'www.linkedin.com', 'lnkd.in'],
      twitter: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com', 't.co'],
      substack: ['substack.com', '*.substack.com'],
      tiktok: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
      youtube: ['youtube.com', 'www.youtube.com', 'youtu.be', 'yt.be'],
      medium: ['medium.com', '*.medium.com'],
      reddit: ['reddit.com', 'www.reddit.com', 'redd.it'],
      github: ['github.com', 'www.github.com', 'gist.github.com'],
      snapchat: ['snapchat.com', 'www.snapchat.com'],
      pinterest: ['pinterest.com', 'www.pinterest.com', 'pin.it'],
      whatsapp: ['whatsapp.com', 'www.whatsapp.com', 'wa.me'],
      telegram: ['t.me', 'telegram.me', 'telegram.org'],
      discord: ['discord.gg', 'discord.com', 'discordapp.com'],
      twitch: ['twitch.tv', 'www.twitch.tv'],
      vimeo: ['vimeo.com', 'www.vimeo.com'],
      patreon: ['patreon.com', 'www.patreon.com'],
      threads: ['threads.net', 'www.threads.net'],
      mastodon: ['mastodon.social', '*.mastodon.social'],
    };
    
    // Check if specific platform was requested
    if (platform) {
      const platformKey = platform.toLowerCase();
      if (!allowedDomains[platformKey]) {
        return {
          isValid: false,
          url: null,
          message: `Unsupported platform: ${platform}`
        };
      }
      
      // Check domain match, including wildcards
      const isValid = allowedDomains[platformKey].some(domain => {
        if (domain.startsWith('*.')) {
          return hostname.endsWith(domain.substring(1));
        }
        return hostname === domain || hostname.endsWith('.' + domain);
      });
      
      if (!isValid) {
        return {
          isValid: false,
          url: null,
          message: `This doesn't appear to be a valid ${platform} URL`
        };
      }
      
      // Normalize URL for specific platforms
      let normalizedUrl = parsedURL.toString();
      
      // Platform-specific URL normalization
      if (platformKey === 'twitter' || platformKey === 'x') {
        // Remove query parameters from Twitter URLs except for specific ones
        const username = parsedURL.pathname.split('/')[1];
        
        if (username && !['search', 'hashtag', 'explore'].includes(username)) {
          // It's a profile URL, keep it clean
          normalizedUrl = `https://twitter.com/${username}`;
        }
      } else if (platformKey === 'instagram') {
        // Clean Instagram URLs
        const username = parsedURL.pathname.split('/')[1];
        
        if (username && username !== 'p' && username !== 'explore') {
          // It's a profile URL
          normalizedUrl = `https://instagram.com/${username}`;
        }
      }
      
      return {
        isValid: true,
        url: normalizedUrl,
        platform: platformKey
      };
    }
    
    // Check all platforms
    for (const [platformName, domains] of Object.entries(allowedDomains)) {
      const isMatch = domains.some(domain => {
        if (domain.startsWith('*.')) {
          return hostname.endsWith(domain.substring(1));
        }
        return hostname === domain || hostname.endsWith('.' + domain);
      });
      
      if (isMatch) {
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
    return { 
      isValid: false, 
      url: null,
      message: 'Invalid URL format'
    };
  }
};

/**
 * Validate post content with improved checks
 * 
 * @param {Object} post - Post data to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validatePost = (post) => {
  const errors = {};
  
  if (!post) {
    errors.general = 'Post data is required';
    return {
      isValid: false,
      errors
    };
  }
  
  // Validate post type
  if (!post.type || !['text', 'image', 'video', 'link', 'poll'].includes(post.type)) {
    errors.type = 'Invalid post type';
  }
  
  // Validate caption/text based on post type
  if (post.type === 'text') {
    if (!post.text && !post.caption) {
      errors.text = 'Text is required for text posts';
    } else if ((post.text || post.caption || '').length > 5000) {
      errors.text = 'Text is too long (maximum 5000 characters)';
    }
  } else if ((post.type === 'image' || post.type === 'video') && !post.caption && !post.text) {
    // Caption is optional for media posts, but validate length if provided
    if (post.caption && post.caption.length > 2000) {
      errors.caption = 'Caption is too long (maximum 2000 characters)';
    }
  }
  
  // Validate image for image posts
  if (post.type === 'image' && !post.imageUri && !post.content && !post.images) {
    errors.image = 'Please select an image';
  }
  
  // Validate video for video posts
  if (post.type === 'video' && !post.videoUri && !post.content) {
    errors.video = 'Please select a video';
  }
  
  // Validate URL for link posts
  if (post.type === 'link') {
    const urlValidation = validateUrl(post.linkUrl, true);
    if (!urlValidation.isValid) {
      errors.linkUrl = urlValidation.message || 'Please enter a valid URL';
    }
  }
  
  // Validate poll options if it's a poll
  if (post.type === 'poll') {
    if (!post.pollOptions || !Array.isArray(post.pollOptions) || post.pollOptions.length < 2) {
      errors.pollOptions = 'Please provide at least 2 poll options';
    } else {
      // Check if any poll option is empty
      const hasEmptyOption = post.pollOptions.some(option => !option || !option.trim());
      if (hasEmptyOption) {
        errors.pollOptions = 'Poll options cannot be empty';
      }
    }
  }
  
  // Check for potentially sensitive content
  if (post.text || post.caption) {
    const content = (post.text || post.caption).toLowerCase();
    const sensitivePatterns = [
      /\b(suicide|kill\s*(?:my|your)self|die)\b/i,
      /\b(cocaine|heroin|meth|marijuana|weed)\b/i
    ];
    
    for (const pattern of sensitivePatterns) {
      if (pattern.test(content)) {
        if (!errors.warnings) errors.warnings = [];
        errors.warnings.push('This post may contain sensitive content');
        break;
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).filter(key => key !== 'warnings').length === 0,
    errors,
    warnings: errors.warnings
  };
};

/**
 * Validate comment text with improved checks
 * 
 * @param {string} text - Comment text to validate
 * @returns {Object} Validation result with isValid and message
 */
export const validateComment = (text) => {
  if (!text || !text.trim()) {
    return {
      isValid: false,
      message: 'Comment cannot be empty'
    };
  }
  
  const trimmedText = text.trim();
  
  if (trimmedText.length < 1) {
    return {
      isValid: false,
      message: 'Comment is too short'
    };
  }
  
  if (trimmedText.length > 1000) {
    return {
      isValid: false,
      message: 'Comment is too long (maximum 1000 characters)'
    };
  }
  
  // Check for spam patterns
  const spamPatterns = [
    /(\S+)\1{4,}/i, // Repeated words
    /(https?:\/\/\S+\s+){3,}/i, // Multiple URLs
    /([A-Z]{5,}\s*){3,}/ // ALL CAPS SHOUTING
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(trimmedText)) {
      return {
        isValid: false,
        message: 'This comment appears to be spam or promotional content'
      };
    }
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate file size with improved handling
 * 
 * @param {number} fileSize - File size in bytes
 * @param {number} maxSize - Maximum allowed size in MB
 * @returns {Object} Validation result with isValid and message
 */
export const validateFileSize = (fileSize, maxSize) => {
  if (!fileSize && fileSize !== 0) {
    return {
      isValid: false,
      message: 'File size is unknown'
    };
  }
  
  const maxSizeInBytes = maxSize * 1024 * 1024;
  
  if (fileSize > maxSizeInBytes) {
    // Format size for better readability
    const formattedMaxSize = maxSize >= 1 ? `${maxSize} MB` : `${maxSize * 1024} KB`;
    
    return {
      isValid: false,
      message: `File size exceeds maximum allowed size of ${formattedMaxSize}`,
      actualSize: fileSize,
      maxSize: maxSizeInBytes
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate image dimensions with improved aspects
 * 
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid and message
 */
export const validateImageDimensions = (width, height, options = {}) => {
  if (!width || !height) {
    return {
      isValid: false,
      message: 'Image dimensions are required'
    };
  }
  
  const {
    minWidth = 0,
    minHeight = 0,
    maxWidth = 5000,
    maxHeight = 5000,
    aspectRatio = null,
    aspectRatioTolerance = 0.1
  } = options;
  
  // Check minimum dimensions
  if (width < minWidth || height < minHeight) {
    return {
      isValid: false,
      message: `Image is too small (minimum ${minWidth}x${minHeight} pixels)`
    };
  }
  
  // Check maximum dimensions
  if (width > maxWidth || height > maxHeight) {
    return {
      isValid: false,
      message: `Image is too large (maximum ${maxWidth}x${maxHeight} pixels)`
    };
  }
  
  // Check aspect ratio if specified
  if (aspectRatio !== null) {
    const imageRatio = width / height;
    const minRatio = aspectRatio - aspectRatioTolerance;
    const maxRatio = aspectRatio + aspectRatioTolerance;
    
    if (imageRatio < minRatio || imageRatio > maxRatio) {
      // Format the expected ratio for display
      let ratioText = '';
      if (aspectRatio === 1) {
        ratioText = 'square (1:1)';
      } else if (aspectRatio === 16/9) {
        ratioText = '16:9';
      } else if (aspectRatio === 4/3) {
        ratioText = '4:3';
      } else if (aspectRatio === 3/2) {
        ratioText = '3:2';
      } else {
        ratioText = aspectRatio.toFixed(2);
      }
      
      return {
        isValid: false,
        message: `Image aspect ratio should be approximately ${ratioText}`,
        actualRatio: imageRatio,
        expectedRatio: aspectRatio
      };
    }
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate video duration with improved feedback
 * 
 * @param {number} duration - Video duration in milliseconds
 * @param {number} maxDuration - Maximum allowed duration in seconds
 * @param {number} minDuration - Minimum allowed duration in seconds
 * @returns {Object} Validation result with isValid and message
 */
export const validateVideoDuration = (duration, maxDuration, minDuration = 1) => {
  if (!duration && duration !== 0) {
    return {
      isValid: false,
      message: 'Video duration is unknown'
    };
  }
  
  const durationInSeconds = duration / 1000;
  
  if (durationInSeconds < minDuration) {
    return {
      isValid: false,
      message: `Video is too short (minimum ${minDuration} second${minDuration !== 1 ? 's' : ''})`,
      actualDuration: durationInSeconds,
      minDuration: minDuration
    };
  }
  
  if (durationInSeconds > maxDuration) {
    // Format duration for better readability
    const formattedMaxDuration = maxDuration >= 60 
      ? `${Math.floor(maxDuration / 60)} minute${Math.floor(maxDuration / 60) !== 1 ? 's' : ''} ${maxDuration % 60 ? `${maxDuration % 60} seconds` : ''}`
      : `${maxDuration} seconds`;
    
    return {
      isValid: false,
      message: `Video duration exceeds maximum allowed duration of ${formattedMaxDuration}`,
      actualDuration: durationInSeconds,
      maxDuration: maxDuration
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate file type with improved MIME type handling
 * 
 * @param {string} mimeType - File MIME type
 * @param {Array<string>} allowedTypes - Array of allowed MIME types
 * @returns {Object} Validation result with isValid and message
 */
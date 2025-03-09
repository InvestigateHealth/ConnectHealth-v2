// src/utils/validationUtils.js
// Comprehensive validation utilities for forms and data

/**
 * Validate email format
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

  // Email regex - validates standard email formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      message: 'Please enter a valid email address'
    };
  }

  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate password strength
 * 
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid and message
 */
export const validatePassword = (password, options = {}) => {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = false,
    required = true
  } = options;

  if (!password) {
    return {
      isValid: !required,
      message: required ? 'Password is required' : ''
    };
  }

  if (password.length < minLength) {
    return {
      isValid: false,
      message: `Password must be at least ${minLength} characters long`
    };
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one uppercase letter'
    };
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one lowercase letter'
    };
  }

  if (requireNumbers && !/\d/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one number'
    };
  }

  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return {
      isValid: false,
      message: 'Password must contain at least one special character'
    };
  }

  return {
    isValid: true,
    message: ''
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
 * Validate name input
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

  // Check that name contains only letters, spaces, hyphens and apostrophes
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  
  if (!nameRegex.test(name)) {
    return {
      isValid: false,
      message: `${fieldName} can only contain letters, spaces, hyphens, and apostrophes`
    };
  }

  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate URL format
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

  // Try to create a URL object - this validates the URL format
  try {
    // Add protocol if missing
    let testUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      testUrl = 'https://' + url;
    }
    
    new URL(testUrl);
    return {
      isValid: true,
      message: ''
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
  
  // Add https:// if no protocol specified
  if (!/^https?:\/\//i.test(url)) {
    return 'https://' + url;
  }
  
  return url;
};

/**
 * Extract domain from URL
 * 
 * @param {string} url - URL to process
 * @returns {string} Domain name
 */
export const extractDomain = (url) => {
  try {
    const formatted = formatUrl(url);
    const urlObj = new URL(formatted);
    return urlObj.hostname.replace('www.', '');
  } catch (e) {
    return url;
  }
};

/**
 * Validate social media link
 * 
 * @param {string} url - Social media URL to validate
 * @param {string} platform - Platform to validate for (optional)
 * @returns {Object} Validation result with status and sanitized URL
 */
export const validateSocialMediaLink = (url, platform = null) => {
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
};

/**
 * Validate post content
 * 
 * @param {Object} post - Post data to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validatePost = (post) => {
  const errors = {};
  
  // Validate caption/text
  if (post.type !== 'image' && post.type !== 'video' && (!post.caption || !post.caption.trim())) {
    errors.caption = 'Caption is required for text posts';
  }
  
  // Validate image for image posts
  if (post.type === 'image' && !post.imageUri && !post.content) {
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
      errors.linkUrl = urlValidation.message;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validate comment text
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
  
  if (text.length > 1000) {
    return {
      isValid: false,
      message: 'Comment is too long (maximum 1000 characters)'
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate file size
 * 
 * @param {number} fileSize - File size in bytes
 * @param {number} maxSize - Maximum allowed size in MB
 * @returns {Object} Validation result with isValid and message
 */
export const validateFileSize = (fileSize, maxSize) => {
  const maxSizeInBytes = maxSize * 1024 * 1024;
  
  if (fileSize > maxSizeInBytes) {
    return {
      isValid: false,
      message: `File size exceeds maximum allowed size of ${maxSize}MB`
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate image dimensions
 * 
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid and message
 */
export const validateImageDimensions = (width, height, options = {}) => {
  const {
    minWidth = 0,
    minHeight = 0,
    maxWidth = Infinity,
    maxHeight = Infinity,
  } = options;
  
  if (width < minWidth || height < minHeight) {
    return {
      isValid: false,
      message: `Image dimensions are too small (minimum ${minWidth}x${minHeight})`
    };
  }
  
  if (width > maxWidth || height > maxHeight) {
    return {
      isValid: false,
      message: `Image dimensions are too large (maximum ${maxWidth}x${maxHeight})`
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate video duration
 * 
 * @param {number} duration - Video duration in milliseconds
 * @param {number} maxDuration - Maximum allowed duration in seconds
 * @returns {Object} Validation result with isValid and message
 */
export const validateVideoDuration = (duration, maxDuration) => {
  const durationInSeconds = duration / 1000;
  
  if (durationInSeconds > maxDuration) {
    return {
      isValid: false,
      message: `Video duration exceeds maximum allowed duration of ${maxDuration} seconds`
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate file type
 * 
 * @param {string} mimeType - File MIME type
 * @param {Array<string>} allowedTypes - Array of allowed MIME types
 * @returns {Object} Validation result with isValid and message
 */
export const validateFileType = (mimeType, allowedTypes) => {
  if (!allowedTypes.includes(mimeType)) {
    return {
      isValid: false,
      message: `File type not supported. Allowed types: ${allowedTypes.join(', ')}`
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate image file type
 * 
 * @param {string} mimeType - Image MIME type
 * @returns {Object} Validation result with isValid and message
 */
export const validateImageType = (mimeType) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
  return validateFileType(mimeType, allowedTypes);
};

/**
 * Validate video file type
 * 
 * @param {string} mimeType - Video MIME type
 * @returns {Object} Validation result with isValid and message
 */
export const validateVideoType = (mimeType) => {
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/webm', 'video/ogg'];
  return validateFileType(mimeType, allowedTypes);
};

/**
 * Validate phone number format
 * 
 * @param {string} phone - Phone number to validate
 * @param {boolean} required - Whether the phone is required
 * @returns {Object} Validation result with isValid and message
 */
export const validatePhone = (phone, required = false) => {
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
  
  // Simple phone validation - allows various formats
  const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
  
  if (!phoneRegex.test(phone)) {
    return {
      isValid: false,
      message: 'Please enter a valid phone number'
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate username format
 * 
 * @param {string} username - Username to validate
 * @returns {Object} Validation result with isValid and message
 */
export const validateUsername = (username) => {
  if (!username || !username.trim()) {
    return {
      isValid: false,
      message: 'Username is required'
    };
  }
  
  // Username can only contain letters, numbers, underscores, and periods
  const usernameRegex = /^[a-zA-Z0-9_.]+$/;
  
  if (!usernameRegex.test(username)) {
    return {
      isValid: false,
      message: 'Username can only contain letters, numbers, underscores, and periods'
    };
  }
  
  if (username.length < 3) {
    return {
      isValid: false,
      message: 'Username must be at least 3 characters long'
    };
  }
  
  if (username.length > 30) {
    return {
      isValid: false,
      message: 'Username cannot exceed 30 characters'
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate date
 * 
 * @param {Date|string} date - Date to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result with isValid and message
 */
export const validateDate = (date, options = {}) => {
  const {
    required = false,
    minDate = null,
    maxDate = null
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
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if valid date
  if (isNaN(dateObj.getTime())) {
    return {
      isValid: false,
      message: 'Please enter a valid date'
    };
  }
  
  // Check min date
  if (minDate && dateObj < new Date(minDate)) {
    return {
      isValid: false,
      message: `Date must be after ${new Date(minDate).toLocaleDateString()}`
    };
  }
  
  // Check max date
  if (maxDate && dateObj > new Date(maxDate)) {
    return {
      isValid: false,
      message: `Date must be before ${new Date(maxDate).toLocaleDateString()}`
    };
  }
  
  return {
    isValid: true,
    message: ''
  };
};

/**
 * Validate user profile data
 * 
 * @param {Object} profile - Profile data to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateUserProfile = (profile) => {
  const errors = {};
  
  // Validate first name
  const firstNameValidation = validateName(profile.firstName, 'First name');
  if (!firstNameValidation.isValid) {
    errors.firstName = firstNameValidation.message;
  }
  
  // Validate last name
  const lastNameValidation = validateName(profile.lastName, 'Last name');
  if (!lastNameValidation.isValid) {
    errors.lastName = lastNameValidation.message;
  }
  
  // Validate bio if provided
  if (profile.bio && profile.bio.length > 500) {
    errors.bio = 'Bio cannot exceed 500 characters';
  }
  
  // Validate medical conditions
  if (profile.medicalConditions && !Array.isArray(profile.medicalConditions)) {
    errors.medicalConditions = 'Medical conditions must be a list';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Sanitize user input to prevent XSS
 * 
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
export const sanitizeInput = (input) => {
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
};

/**
 * Run multiple validations and combine results
 * 
 * @param {Array} validations - Array of validation objects with field and validation result
 * @returns {Object} Combined validation result with isValid and errors
 */
export const combineValidations = (validations) => {
  const errors = {};
  
  validations.forEach(({ field, validation }) => {
    if (!validation.isValid) {
      errors[field] = validation.message;
    }
  });
  
  return {
    isValid: Object.keys(errors).length === 0,
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
  
  return Object.values(errors).join('\n');
};

/**
 * Check if email domain is from disposable email provider
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

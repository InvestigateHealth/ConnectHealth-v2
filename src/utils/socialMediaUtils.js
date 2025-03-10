// src/utils/socialMediaUtils.js
import { Linking } from 'react-native';
import Share from 'react-native-share';

/**
 * Utility class for handling social media links and sharing functionality
 */
export default class SocialMediaUtils {
  /**
   * Regular expressions for extracting content from social media URLs
   */
  static URL_REGEX = {
    // Extract Facebook post/video IDs
    FACEBOOK_POST: /facebook\.com\/(?:[^\/]+\/posts\/|permalink\.php\?story_fbid=|[^\/]+\/(?:videos|photos|permalink)\/|watch\/\?v=)(\d+)/i,
    // Extract Instagram post IDs
    INSTAGRAM_POST: /instagram\.com\/p\/([a-zA-Z0-9_-]+)/i,
    // Extract Twitter IDs
    TWITTER_STATUS: /twitter\.com\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i,
    // Extract YouTube video IDs
    YOUTUBE_VIDEO: /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
  };
  // Define supported social media platforms and their URL patterns
  static PLATFORMS = {
    FACEBOOK: {
      name: 'Facebook',
      urlPatterns: [
        'facebook.com',
        'fb.com',
        'fb.watch',
        'm.facebook.com'
      ],
      icon: 'facebook',
      color: '#3b5998'
    },
    INSTAGRAM: {
      name: 'Instagram',
      urlPatterns: [
        'instagram.com',
        'instagr.am',
        'instagram.co'
      ],
      icon: 'instagram',
      color: '#e1306c'
    },
    LINKEDIN: {
      name: 'LinkedIn',
      urlPatterns: [
        'linkedin.com',
        'lnkd.in'
      ],
      icon: 'linkedin',
      color: '#0077b5'
    },
    TWITTER: {
      name: 'Twitter',
      urlPatterns: [
        'twitter.com',
        'x.com',
        't.co'
      ],
      icon: 'twitter',
      color: '#1da1f2'
    },
    YOUTUBE: {
      name: 'YouTube',
      urlPatterns: [
        'youtube.com',
        'youtu.be'
      ],
      icon: 'youtube',
      color: '#ff0000'
    },
    TIKTOK: {
      name: 'TikTok',
      urlPatterns: [
        'tiktok.com',
        'vm.tiktok.com'
      ],
      icon: 'music',
      color: '#000000'
    },
    SUBSTACK: {
      name: 'Substack',
      urlPatterns: [
        'substack.com'
      ],
      icon: 'file-text',
      color: '#ff6719'
    },
    MEDIUM: {
      name: 'Medium',
      urlPatterns: [
        'medium.com'
      ],
      icon: 'type',
      color: '#00ab6c'
    }
  };

  /**
   * Extract content ID from social media URL
   * @param {string} url - Social media URL
   * @returns {string|null} - Extracted content ID or null
   */
  static extractContentId(url) {
    if (!url) return null;
    
    // Try each regex pattern
    for (const [key, regex] of Object.entries(this.URL_REGEX)) {
      const match = url.match(regex);
      if (match) {
        // Different platforms have different match group indexes
        if (key === 'TWITTER_STATUS') {
          return { username: match[1], statusId: match[2] };
        }
        return match[1]; // Most platforms have the ID in the first capture group
      }
    }
    
    return null;
  }
  
  /**
   * Share content via SMS
   * @param {string} message - Message to share
   * @param {string} url - Optional URL to include
   * @returns {Promise<boolean>} - Success status
   */
  static async shareViaSMS(message, url = '') {
    try {
      const content = url ? `${message}: ${url}` : message;
      const smsOptions = {
        title: 'Share via SMS',
        message: content,
        social: Share.Social.SMS
      };
      
      await Share.shareSingle(smsOptions);
      return true;
    } catch (error) {
      console.error('Error sharing via SMS:', error);
      return false;
    }
  }
  
  /**
   * Share content via email
   * @param {string} subject - Email subject
   * @param {string} body - Email body
   * @param {string} url - Optional URL to include
   * @returns {Promise<boolean>} - Success status
   */
  static async shareViaEmail(subject, body, url = '') {
    try {
      const content = url ? `${body}\n\n${url}` : body;
      const emailOptions = {
        title: 'Share via Email',
        subject: subject,
        message: content,
        social: Share.Social.EMAIL
      };
      
      await Share.shareSingle(emailOptions);
      return true;
    } catch (error) {
      console.error('Error sharing via email:', error);
      return false;
    }
  }
  
  /**
   * Open a URL in appropriate app or browser
   * @param {string} url - URL to open
   * @returns {Promise<boolean>} - Success status
   */
  static async openUrl(url) {
    if (!url) return false;
    
    try {
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
        return true;
      } else {
        console.warn(`Cannot open URL: ${url}`);
        return false;
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      return false;
    }
  }
  
  /**
   * Share content to any available share target
   * @param {Object} options - Share options
   * @returns {Promise<Object>} - Share result
   */
  static async shareContent(options = {}) {
    const defaultOptions = {
      title: 'Share Content',
      message: '',
      url: '',
    };
    
    const shareOptions = {...defaultOptions, ...options};
    
    try {
      const result = await Share.open(shareOptions);
      return result;
    } catch (error) {
      console.error('Error sharing content:', error);
      throw error;
    }
  }
  }
  
  /**
   * Detect social media platform from a URL
   * @param {string} url - The URL to check
   * @returns {Object|null} - Platform object or null if not a social media URL
   */
  static detectPlatform(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }
    
    // Clean the URL for comparison
    const cleanUrl = url.toLowerCase().trim();
    
    // Check each platform's URL patterns
    for (const [platform, details] of Object.entries(this.PLATFORMS)) {
      if (details.urlPatterns.some(pattern => cleanUrl.includes(pattern))) {
        return {
          platform,
          ...details
        };
      }
    }
    
    return null;
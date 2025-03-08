// src/services/LinkService.js
// Service for handling links from various social media platforms

import { getLinkPreview } from 'link-preview-js';

// List of popular social media domains
const POPULAR_PLATFORMS = [
  { name: 'Facebook', domain: 'facebook.com', icon: 'logo-facebook' },
  { name: 'Instagram', domain: 'instagram.com', icon: 'logo-instagram' },
  { name: 'Twitter', domain: 'twitter.com', icon: 'logo-twitter' },
  { name: 'X', domain: 'x.com', icon: 'logo-twitter' },
  { name: 'LinkedIn', domain: 'linkedin.com', icon: 'logo-linkedin' },
  { name: 'YouTube', domain: 'youtube.com', icon: 'logo-youtube' },
  { name: 'TikTok', domain: 'tiktok.com', icon: 'musical-notes' },
  { name: 'Substack', domain: 'substack.com', icon: 'newspaper' },
  { name: 'Medium', domain: 'medium.com', icon: 'document-text' },
  { name: 'Pinterest', domain: 'pinterest.com', icon: 'logo-pinterest' },
  { name: 'Reddit', domain: 'reddit.com', icon: 'logo-reddit' },
  { name: 'Tumblr', domain: 'tumblr.com', icon: 'logo-tumblr' },
  { name: 'Spotify', domain: 'spotify.com', icon: 'musical-note' },
  { name: 'SoundCloud', domain: 'soundcloud.com', icon: 'cloud' },
  { name: 'Vimeo', domain: 'vimeo.com', icon: 'videocam' },
  { name: 'Twitch', domain: 'twitch.tv', icon: 'game-controller' },
  { name: 'Snapchat', domain: 'snapchat.com', icon: 'logo-snapchat' },
  { name: 'WhatsApp', domain: 'whatsapp.com', icon: 'logo-whatsapp' },
  { name: 'Telegram', domain: 'telegram.org', icon: 'paper-plane' },
  { name: 'Discord', domain: 'discord.com', icon: 'logo-discord' },
  { name: 'GitHub', domain: 'github.com', icon: 'logo-github' },
  { name: 'Quora', domain: 'quora.com', icon: 'help-circle' },
  // Health-related platforms
  { name: 'WebMD', domain: 'webmd.com', icon: 'medical' },
  { name: 'Healthline', domain: 'healthline.com', icon: 'medkit' },
  { name: 'Mayo Clinic', domain: 'mayoclinic.org', icon: 'medical' },
  { name: 'CDC', domain: 'cdc.gov', icon: 'medical' },
  { name: 'WHO', domain: 'who.int', icon: 'globe' },
  { name: 'NIH', domain: 'nih.gov', icon: 'flask' },
  { name: 'MedlinePlus', domain: 'medlineplus.gov', icon: 'medical' },
  { name: 'PubMed', domain: 'pubmed.ncbi.nlm.nih.gov', icon: 'document-text' },
];

class LinkService {
  /**
   * Get preview data for a URL
   * 
   * @param {string} url - URL to get preview for
   * @param {Object} options - Optional settings
   * @returns {Promise<Object>} Link preview data
   */
  getLinkPreview = async (url, options = {}) => {
    try {
      // Ensure URL has protocol
      const normalizedUrl = this.normalizeUrl(url);
      
      // Default options
      const defaultOptions = {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
        },
        followRedirects: true,
      };
      
      // Merge options
      const mergedOptions = { ...defaultOptions, ...options };
      
      // Get preview data
      const data = await getLinkPreview(normalizedUrl, mergedOptions);
      
      // Add platform info
      const platformInfo = this.identifyPlatform(normalizedUrl);
      
      return {
        ...data,
        ...platformInfo,
        originalUrl: url,
        url: normalizedUrl,
      };
    } catch (error) {
      console.error('Error getting link preview:', error);
      
      // Return basic data if preview fails
      return {
        url: this.normalizeUrl(url),
        originalUrl: url,
        title: url,
        ...this.identifyPlatform(url),
      };
    }
  };
  
  /**
   * Check if a string is a valid URL
   * 
   * @param {string} url - URL to validate
   * @returns {boolean} Whether the URL is valid
   */
  isValidUrl = (url) => {
    try {
      // Add protocol if missing
      const normalizedUrl = this.normalizeUrl(url);
      new URL(normalizedUrl);
      return true;
    } catch (error) {
      return false;
    }
  };
  
  /**
   * Ensure URL has a protocol
   * 
   * @param {string} url - URL to normalize
   * @returns {string} Normalized URL
   */
  normalizeUrl = (url) => {
    if (!url) return '';
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      return `https://${url}`;
    }
    return url;
  };
  
  /**
   * Try to identify which platform a URL belongs to
   * 
   * @param {string} url - URL to identify
   * @returns {Object} Platform information
   */
  identifyPlatform = (url) => {
    try {
      // Ensure URL has protocol for parsing
      const normalizedUrl = this.normalizeUrl(url);
      
      // Parse URL
      const urlObj = new URL(normalizedUrl);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Check against known platforms
      for (const platform of POPULAR_PLATFORMS) {
        if (hostname.includes(platform.domain) || 
            hostname.endsWith(`.${platform.domain}`)) {
          return {
            platform: platform.name,
            platformIcon: platform.icon,
            isKnownPlatform: true,
          };
        }
      }
      
      // No match found
      return {
        platform: 'Website',
        platformIcon: 'globe',
        isKnownPlatform: false,
      };
    } catch (error) {
      return {
        platform: 'Website',
        platformIcon: 'globe',
        isKnownPlatform: false,
      };
    }
  };
  
  /**
   * Extract username from social media URL
   * 
   * @param {string} url - Social media URL
   * @returns {string|null} Username or null if not found
   */
  extractUsername = (url) => {
    try {
      const normalizedUrl = this.normalizeUrl(url);
      const urlObj = new URL(normalizedUrl);
      const hostname = urlObj.hostname.toLowerCase();
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      // Different platforms have different URL structures
      if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        return pathParts[0]; // twitter.com/username
      } else if (hostname.includes('instagram.com')) {
        return pathParts[0]; // instagram.com/username
      } else if (hostname.includes('facebook.com')) {
        if (pathParts.length > 0) {
          return pathParts[0]; // facebook.com/username
        }
      } else if (hostname.includes('linkedin.com')) {
        if (pathParts[0] === 'in' && pathParts.length > 1) {
          return pathParts[1]; // linkedin.com/in/username
        }
      } else if (hostname.includes('youtube.com')) {
        if (pathParts[0] === 'channel' && pathParts.length > 1) {
          return pathParts[1]; // youtube.com/channel/channelId
        } else if (pathParts[0] === 'c' && pathParts.length > 1) {
          return pathParts[1]; // youtube.com/c/channelName
        } else if (pathParts[0] === 'user' && pathParts.length > 1) {
          return pathParts[1]; // youtube.com/user/username
        } else if (pathParts[0] === '@') {
          return pathParts[0]; // youtube.com/@username
        }
      } else if (hostname.includes('tiktok.com')) {
        if (pathParts[0] && pathParts[0].startsWith('@')) {
          return pathParts[0]; // tiktok.com/@username
        }
      } else if (hostname.includes('github.com')) {
        return pathParts[0]; // github.com/username
      } else if (hostname.includes('medium.com')) {
        return pathParts[0]; // medium.com/@username
      } else if (hostname.includes('substack.com')) {
        return hostname.split('.')[0]; // username.substack.com
      }
      
      return null;
    } catch (error) {
      return null;
    }
  };
  
  /**
   * Try to create a direct content embed URL for supported platforms
   * 
   * @param {string} url - Original URL
   * @returns {string|null} Embed URL or null if not supported
   */
  getEmbedUrl = (url) => {
    try {
      const normalizedUrl = this.normalizeUrl(url);
      const urlObj = new URL(normalizedUrl);
      const hostname = urlObj.hostname.toLowerCase();
      
      // YouTube
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
        let videoId;
        
        if (hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.split('/')[1];
        } else if (urlObj.pathname.includes('watch')) {
          videoId = urlObj.searchParams.get('v');
        } else if (urlObj.pathname.includes('embed')) {
          videoId = urlObj.pathname.split('/')[2];
        }
        
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }
      
      // Twitter
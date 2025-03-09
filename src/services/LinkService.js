// src/services/LinkService.js
// Service for handling links from various social media platforms

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

// List of malicious TLDs and domains to block
const BLOCKED_DOMAINS = [
  'xyz', 'pw', 'top', 'club', 'work', 'ml', 'ga', 'cf', 'gq', 'tk',
  'bit.ly', 'tinyurl.com', 'goo.gl', 'is.gd', 'cli.gs', 'pic.gd', 'DwarfURL.com',
  'ow.ly', 'yfrog', 'migre.me', 'ff.im', 'tiny.cc', 'url4.eu', 'tr.im',
  'twit.ac', 'su.pr', 'twurl.nl', 'snipurl.com', 'budurl.com', 'short.to',
  'BudURL.com', 'ping.fm', 'post.ly', 'Just.as', 'bkite.com', 'snipr.com',
  'fic.kr', 'loopt.us', 'doiop.com', 'twitthis.com', 'htxt.it', 'AltURL.com',
  'RedirX.com', 'DigBig.com', 'short.ie', 'u.mavrev.com', 'kl.am', 'wp.me',
  'u.nu', 'rubyurl.com', 'om.ly', 'linkbee.com', 'Yep.it', 'posted.at',
  'xrl.us', 'metamark.net', 'sn.im', 'hulu.com', 'jpeg.ly', 'urlkiss.com',
  'QLNK.net', 'w3t.org', 'prettylinkpro.com', 'ne1.net', 'tr.my', 'Fon.gs',
  'baid.us', 'yourls.org', 'adcraft.co', 'virl.com', 'dft.ba', 'qr.net',
  'youtu.be', '1click.at'
];

class LinkService {
  /**
   * Get preview data for a URL
   * 
   * @param {string} url - URL to get preview for
   * @param {Object} options - Optional settings
   * @returns {Promise<Object>} Link preview data
   */
  async getLinkPreview(url, options = {}) {
    try {
      // Validate the URL before proceeding
      if (!this.isValidUrl(url)) {
        throw new Error('Invalid URL format');
      }
      
      // Check if URL is potentially malicious
      if (this.isPotentiallyMalicious(url)) {
        throw new Error('URL flagged as potentially unsafe');
      }
      
      // Ensure URL has protocol
      const normalizedUrl = this.normalizeUrl(url);
      
      // Import the library dynamically to reduce initial bundle size
      const { getLinkPreview } = await import('link-preview-js');
      
      // Default options
      const defaultOptions = {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
        },
        followRedirects: true,
        // Limit redirects to prevent redirect loops
        maxRedirects: 3,
      };
      
      // Merge options
      const mergedOptions = { ...defaultOptions, ...options };
      
      // Get preview data with timeout
      const data = await Promise.race([
        getLinkPreview(normalizedUrl, mergedOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Preview request timed out')), 15000)
        )
      ]);
      
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
        error: error.message,
      };
    }
  }
  
  /**
   * Check if a string is a valid URL
   * 
   * @param {string} url - URL to validate
   * @returns {boolean} Whether the URL is valid
   */
  isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Simple initial check
    const trimmedUrl = url.trim();
    if (trimmedUrl.length < 3) return false;
    
    try {
      // Add protocol if missing for URL parsing
      const normalizedUrl = this.normalizeUrl(trimmedUrl);
      const parsedUrl = new URL(normalizedUrl);
      
      // Check for valid protocol
      const protocol = parsedUrl.protocol.toLowerCase();
      if (protocol !== 'http:' && protocol !== 'https:') {
        return false;
      }
      
      // Check for valid hostname
      const hostname = parsedUrl.hostname;
      if (!hostname || hostname.length < 3 || !hostname.includes('.')) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Check if a URL is potentially malicious
   * 
   * @param {string} url - URL to check
   * @returns {boolean} Whether the URL is potentially malicious
   */
  isPotentiallyMalicious(url) {
    try {
      if (!url) return true;
      
      const normalizedUrl = this.normalizeUrl(url);
      const parsedUrl = new URL(normalizedUrl);
      const hostname = parsedUrl.hostname.toLowerCase();
      
      // Check against known malicious domains
      for (const domain of BLOCKED_DOMAINS) {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          return true;
        }
      }
      
      // Check for suspicious TLDs
      const tld = hostname.split('.').pop();
      if (BLOCKED_DOMAINS.includes(tld)) {
        return true;
      }
      
      // Check for IP address URLs
      const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
      if (ipPattern.test(hostname)) {
        return true;
      }
      
      // Check for extremely long hostnames (potential IDN homograph attack)
      if (hostname.length > 50) {
        return true;
      }
      
      // Check for excessive subdomains
      const subdomainCount = hostname.split('.').length - 1;
      if (subdomainCount > 4) {
        return true;
      }
      
      return false;
    } catch (error) {
      // If we can't parse it, consider it unsafe
      return true;
    }
  }
  
  /**
   * Ensure URL has a protocol
   * 
   * @param {string} url - URL to normalize
   * @returns {string} Normalized URL
   */
  normalizeUrl(url) {
    if (!url) return '';
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      return `https://${url}`;
    }
    return url;
  }
  
  /**
   * Try to identify which platform a URL belongs to
   * 
   * @param {string} url - URL to identify
   * @returns {Object} Platform information
   */
  identifyPlatform(url) {
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
  }
  
  /**
   * Extract username from social media URL
   * 
   * @param {string} url - Social media URL
   * @returns {string|null} Username or null if not found
   */
  extractUsername(url) {
    try {
      if (!this.isValidUrl(url)) {
        return null;
      }
      
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
      console.error('Error extracting username:', error);
      return null;
    }
  }
  
  /**
   * Try to create a direct content embed URL for supported platforms
   * 
   * @param {string} url - Original URL
   * @returns {string|null} Embed URL or null if not supported
   */
  getEmbedUrl(url) {
    try {
      if (!this.isValidUrl(url)) {
        return null;
      }
      
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
      
      // Twitter/X
      if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        const statusMatch = urlObj.pathname.match(/\/status\/(\d+)/);
        if (statusMatch && statusMatch[1]) {
          return `https://platform.twitter.com/embed/Tweet.html?id=${statusMatch[1]}`;
        }
      }
      
      // Instagram
      if (hostname.includes('instagram.com')) {
        const postMatch = urlObj.pathname.match(/\/p\/([^\/]+)/);
        if (postMatch && postMatch[1]) {
          return `https://www.instagram.com/p/${postMatch[1]}/embed`;
        }
      }
      
      // Facebook
      if (hostname.includes('facebook.com')) {
        const videoMatch = urlObj.pathname.match(/\/videos\/(\d+)/);
        if (videoMatch && videoMatch[1]) {
          return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(normalizedUrl)}`;
        }
        const postMatch = urlObj.pathname.match(/\/posts\/(\d+)/);
        if (postMatch && postMatch[1]) {
          return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(normalizedUrl)}`;
        }
      }
      
      // Vimeo
      if (hostname.includes('vimeo.com')) {
        const videoId = urlObj.pathname.split('/')[1];
        if (videoId && /^\d+$/.test(videoId)) {
          return `https://player.vimeo.com/video/${videoId}`;
        }
      }
      
      // SoundCloud
      if (hostname.includes('soundcloud.com')) {
        return `https://w.soundcloud.com/player/?url=${encodeURIComponent(normalizedUrl)}`;
      }
      
      // Spotify
      if (hostname.includes('spotify.com')) {
        const trackMatch = urlObj.pathname.match(/\/track\/([a-zA-Z0-9]+)/);
        if (trackMatch && trackMatch[1]) {
          return `https://open.spotify.com/embed/track/${trackMatch[1]}`;
        }
        const albumMatch = urlObj.pathname.match(/\/album\/([a-zA-Z0-9]+)/);
        if (albumMatch && albumMatch[1]) {
          return `https://open.spotify.com/embed/album/${albumMatch[1]}`;
        }
        const playlistMatch = urlObj.pathname.match(/\/playlist\/([a-zA-Z0-9]+)/);
        if (playlistMatch && playlistMatch[1]) {
          return `https://open.spotify.com/embed/playlist/${playlistMatch[1]}`;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error generating embed URL:', error);
      return null;
    }
  }
  
  /**
   * Safely sanitize a URL to prevent XSS and other attacks
   * 
   * @param {string} url - URL to sanitize
   * @returns {string|null} Sanitized URL or null if invalid
   */
  sanitizeUrl(url) {
    try {
      if (!url) return null;
      
      // Check for valid URL
      if (!this.isValidUrl(url)) {
        return null;
      }
      
      // Check if potentially malicious
      if (this.isPotentiallyMalicious(url)) {
        return null;
      }
      
      const normalizedUrl = this.normalizeUrl(url);
      const parsedUrl = new URL(normalizedUrl);
      
      // Check for javascript: or data: URLs (potential XSS vectors)
      const protocol = parsedUrl.protocol.toLowerCase();
      if (protocol === 'javascript:' || protocol === 'data:' || 
          protocol === 'vbscript:' || protocol === 'file:') {
        return null;
      }
      
      // Only allow http and https protocols
      if (protocol !== 'http:' && protocol !== 'https:') {
        return null;
      }
      
      // Remove any unwanted parameters or fragments
      // This is optional and depends on your requirements
      parsedUrl.hash = '';
      
      return parsedUrl.toString();
    } catch (error) {
      console.error('Error sanitizing URL:', error);
      return null;
    }
  }
}

// Create and export singleton instance
export default new LinkService();

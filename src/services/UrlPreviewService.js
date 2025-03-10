// src/services/UrlPreviewService.js
// Service for fetching and caching link previews

import { getLinkPreview } from 'react-native-link-preview';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache expiry in milliseconds (default: 24 hours)
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

/**
 * Get domain name from URL
 * @param {string} url - The URL
 * @returns {string} Domain name
 */
export const getDomainFromURL = (url) => {
  try {
    const domain = new URL(url);
    return domain.hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
};

/**
 * Check if a string is a valid URL
 * @param {string} url - URL to check
 * @returns {boolean} Whether the URL is valid
 */
export const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Extract URLs from text
 * @param {string} text - Text to extract URLs from
 * @returns {Array<string>} Array of URLs
 */
export const extractURLs = (text) => {
  if (!text) return [];
  
  // URL regex pattern
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  return text.match(urlRegex) || [];
};

/**
 * Get link preview data
 * @param {string} url - URL to get preview for
 * @param {Object} options - Options for fetching preview
 * @param {boolean} options.useCache - Whether to use cache (default: true)
 * @param {number} options.timeout - Request timeout in ms (default: 5000)
 * @param {Object} options.headers - Request headers
 * @returns {Promise<Object>} Link preview data
 */
export const getLinkPreviewData = async (url, options = {}) => {
  if (!url || !isValidURL(url)) {
    return null;
  }
  
  const {
    useCache = true,
    timeout = 5000,
    headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    },
  } = options;
  
  try {
    // Generate cache key
    const cacheKey = `link_preview_${url}`;
    
    // Try to get from cache first
    if (useCache) {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        
        // Check if cache is still valid
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          return data;
        }
      }
    }
    
    // Fetch fresh data
    const previewData = await getLinkPreview(url, {
      timeout,
      headers,
      imagesPropertyType: 'og', // prefer og image
    });
    
    // Cleanup and format data
    const result = cleanPreviewData(previewData);
    
    // Save to cache
    if (useCache && result) {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        data: result,
        timestamp: Date.now(),
      }));
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching link preview:', error);
    return null;
  }
};

/**
 * Clean and format preview data
 * @param {Object} data - Raw preview data
 * @returns {Object} Cleaned preview data
 */
const cleanPreviewData = (data) => {
  if (!data) return null;
  
  // Extract and clean relevant data
  const result = {
    url: data.url,
    title: data.title || '',
    description: data.description || '',
    siteName: data.siteName || getDomainFromURL(data.url),
    images: [],
    favicons: [],
    mediaType: data.mediaType || 'website',
  };
  
  // Handle images
  if (data.images && Array.isArray(data.images)) {
    result.images = data.images.filter(img => img && typeof img === 'string');
  }
  
  // Handle favicons
  if (data.favicons && Array.isArray(data.favicons)) {
    result.favicons = data.favicons.filter(icon => icon && typeof icon === 'string');
  }
  
  return result;
};

/**
 * Get multiple link previews
 * @param {Array<string>} urls - URLs to get previews for
 * @param {Object} options - Options for fetching previews
 * @returns {Promise<Object>} Object with URLs as keys and preview data as values
 */
export const getMultipleLinkPreviews = async (urls, options = {}) => {
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return {};
  }
  
  try {
    // Filter out invalid URLs
    const validUrls = urls.filter(url => isValidURL(url));
    
    // Fetch all previews in parallel
    const previewPromises = validUrls.map(url => getLinkPreviewData(url, options));
    const previewResults = await Promise.all(previewPromises);
    
    // Create result object
    const result = {};
    validUrls.forEach((url, index) => {
      if (previewResults[index]) {
        result[url] = previewResults[index];
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error fetching multiple link previews:', error);
    return {};
  }
};

/**
 * Clear link preview cache
 * @returns {Promise<void>}
 */
export const clearLinkPreviewCache = async () => {
  try {
    // Get all AsyncStorage keys
    const keys = await AsyncStorage.getAllKeys();
    
    // Filter link preview cache keys
    const previewCacheKeys = keys.filter(key => key.startsWith('link_preview_'));
    
    // Remove them
    if (previewCacheKeys.length > 0) {
      await AsyncStorage.multiRemove(previewCacheKeys);
    }
  } catch (error) {
    console.error('Error clearing link preview cache:', error);
  }
};

export default {
  getLinkPreviewData,
  getMultipleLinkPreviews,
  clearLinkPreviewCache,
  isValidURL,
  extractURLs,
  getDomainFromURL,
};
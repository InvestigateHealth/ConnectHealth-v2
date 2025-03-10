// src/services/SocialShareService.js
// Service for handling social media sharing functionality

import { Platform, Share, Alert } from 'react-native';
import RNShare from 'react-native-share';
import { AnalyticsService } from './AnalyticsService';
import Config from 'react-native-config';
import MediaService from './MediaService';

/**
 * Available share platforms
 * @readonly
 * @enum {string}
 */
export const SHARE_PLATFORM = {
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  TWITTER: 'twitter',
  LINKEDIN: 'linkedin',
  EMAIL: 'email',
  SMS: 'sms',
  WHATSAPP: 'whatsapp',
  MESSENGER: 'messenger',
  TELEGRAM: 'telegram',
  DEFAULT: 'default'
};

// Get base share URL from config
const SHARE_BASE_URL = Config.SOCIAL_SHARE_BASE_URL || 'https://healthconnect.app/share';

/**
 * Generate a deep link URL for content
 * @param {string} contentType - Type of content (post, event, profile)
 * @param {string} contentId - ID of the content
 * @param {Object} options - Additional options
 * @returns {string} Full share URL
 */
const generateShareUrl = (contentType, contentId, options = {}) => {
  const { utm_source, utm_medium, utm_campaign } = options;
  
  let url = `${SHARE_BASE_URL}/${contentType}/${contentId}`;
  
  // Add UTM parameters if provided
  const params = [];
  if (utm_source) params.push(`utm_source=${utm_source}`);
  if (utm_medium) params.push(`utm_medium=${utm_medium}`);
  if (utm_campaign) params.push(`utm_campaign=${utm_campaign}`);
  
  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  
  return url;
};

/**
 * Share content using the native share dialog
 * @param {Object} options - Share options
 * @param {string} options.title - Content title
 * @param {string} options.message - Content message
 * @param {string} options.url - Content URL (optional)
 * @param {string} options.contentType - Content type (post, event, profile)
 * @param {string} options.contentId - Content ID
 * @param {string} options.imageUrl - Image URL to share (optional)
 * @returns {Promise<Object>} Share result
 */
export const shareContent = async (options) => {
  try {
    const {
      title,
      message,
      url,
      contentType,
      contentId,
      imageUrl,
    } = options;
    
    // Generate share URL if not provided
    const shareUrl = url || generateShareUrl(contentType, contentId, {
      utm_source: 'app',
      utm_medium: 'share',
      utm_campaign: 'user_share'
    });
    
    let shareOptions = {
      title,
      message: `${message} ${shareUrl}`,
      url: shareUrl,
    };
    
    // If there's an image URL, download and share it
    if (imageUrl) {
      try {
        // Use a more reliable way to share images
        return await RNShare.open({
          title,
          message: `${message} ${shareUrl}`,
          url: imageUrl,
          type: 'image/jpeg',
        });
      } catch (error) {
        console.log('Error sharing with image, falling back to text share', error);
        // Fall back to regular share
        return await Share.share(shareOptions);
      }
    }
    
    // Log analytics event
    AnalyticsService.logEvent('content_shared', {
      content_type: contentType,
      content_id: contentId,
      share_method: 'native',
    });
    
    // Use native share dialog
    return await Share.share(shareOptions);
  } catch (error) {
    console.error('Error sharing content:', error);
    throw error;
  }
};

/**
 * Share content to a specific platform
 * @param {string} platform - Platform to share to
 * @param {Object} options - Share options
 * @returns {Promise<Object>} Share result
 */
export const shareToSpecificPlatform = async (platform, options) => {
  try {
    const {
      title,
      message,
      url,
      contentType,
      contentId,
      imageUrl,
    } = options;
    
    // Generate share URL if not provided
    const shareUrl = url || generateShareUrl(contentType, contentId, {
      utm_source: platform,
      utm_medium: 'share',
      utm_campaign: 'user_share'
    });
    
    let result;
    
    switch (platform) {
      case SHARE_PLATFORM.FACEBOOK:
        result = await RNShare.shareSingle({
          social: RNShare.Social.FACEBOOK,
          url: shareUrl,
          title,
          message,
        });
        break;
        
      case SHARE_PLATFORM.TWITTER:
        result = await RNShare.shareSingle({
          social: RNShare.Social.TWITTER,
          url: shareUrl,
          title,
          message,
        });
        break;
        
      case SHARE_PLATFORM.INSTAGRAM:
        // Instagram requires an image to share
        if (!imageUrl) {
          Alert.alert(
            'Instagram Sharing',
            'To share on Instagram, you need to include an image.',
            [{ text: 'OK' }]
          );
          throw new Error('Instagram sharing requires an image');
        }
        
        result = await RNShare.shareSingle({
          social: RNShare.Social.INSTAGRAM,
          url: imageUrl,
          type: 'image/jpeg',
        });
        break;
        
      case SHARE_PLATFORM.LINKEDIN:
        result = await RNShare.shareSingle({
          social: RNShare.Social.LINKEDIN,
          url: shareUrl,
          title,
          message,
        });
        break;
        
      case SHARE_PLATFORM.EMAIL:
        result = await RNShare.shareSingle({
          social: RNShare.Social.EMAIL,
          title,
          message: `${message}\n\n${shareUrl}`,
          subject: title,
        });
        break;
        
      case SHARE_PLATFORM.SMS:
        result = await RNShare.shareSingle({
          social: RNShare.Social.SMS,
          message: `${message} ${shareUrl}`,
        });
        break;
        
      case SHARE_PLATFORM.WHATSAPP:
        result = await RNShare.shareSingle({
          social: RNShare.Social.WHATSAPP,
          url: shareUrl,
          title,
          message,
        });
        break;
        
      case SHARE_PLATFORM.MESSENGER:
        if (Platform.OS === 'android') {
          result = await RNShare.shareSingle({
            social: RNShare.Social.MESSENGER,
            url: shareUrl,
          });
        } else {
          result = await RNShare.shareSingle({
            social: RNShare.Social.FACEBOOK,
            appId: Config.FACEBOOK_APP_ID || '',
            url: shareUrl,
          });
        }
        break;
        
      case SHARE_PLATFORM.TELEGRAM:
        result = await RNShare.shareSingle({
          social: RNShare.Social.TELEGRAM,
          url: shareUrl,
          message,
        });
        break;
        
      case SHARE_PLATFORM.DEFAULT:
      default:
        result = await shareContent(options);
        break;
    }
    
    // Log analytics event
    AnalyticsService.logEvent('content_shared', {
      content_type: contentType,
      content_id: contentId,
      share_method: platform,
    });
    
    return result;
  } catch (error) {
    console.error(`Error sharing to ${platform}:`, error);
    throw error;
  }
};

/**
 * Share post with attached media
 * @param {Object} post - Post data
 * @param {Object} options - Share options
 * @returns {Promise<Object>} Share result
 */
export const sharePostWithMedia = async (post, options = {}) => {
  try {
    const {
      id,
      text,
      title,
      media,
      author,
    } = post;
    
    // Get the first image if available
    let imageUrl = null;
    if (media && media.length > 0) {
      const image = media.find(m => m.type === 'image');
      if (image) {
        imageUrl = image.url;
      }
    }
    
    // Prepare share text
    const shareText = options.message || text || title || '';
    const shareTitle = options.title || `Health post shared by ${author?.displayName || 'a user'}`;
    
    return await shareContent({
      title: shareTitle,
      message: shareText,
      contentType: 'post',
      contentId: id,
      imageUrl,
      ...options,
    });
  } catch (error) {
    console.error('Error sharing post with media:', error);
    throw error;
  }
};

/**
 * Share event
 * @param {Object} event - Event data
 * @param {Object} options - Share options
 * @returns {Promise<Object>} Share result
 */
export const shareEvent = async (event, options = {}) => {
  try {
    const {
      id,
      title,
      description,
      startDate,
      endDate,
      imageUrl,
      location,
    } = event;
    
    // Format date range for display
    let dateInfo = '';
    if (startDate) {
      const startDateObj = new Date(startDate);
      dateInfo = startDateObj.toLocaleDateString();
      
      if (endDate) {
        const endDateObj = new Date(endDate);
        if (startDateObj.toDateString() !== endDateObj.toDateString()) {
          dateInfo += ` - ${endDateObj.toLocaleDateString()}`;
        }
      }
    }
    
    // Prepare share text
    const locationText = location ? ` at ${location}` : '';
    const shareText = options.message || 
      `Join me for "${title}"${dateInfo ? ` on ${dateInfo}` : ''}${locationText}. ${description || ''}`;
    
    return await shareContent({
      title: options.title || `Event: ${title}`,
      message: shareText,
      contentType: 'event',
      contentId: id,
      imageUrl,
      ...options,
    });
  } catch (error) {
    console.error('Error sharing event:', error);
    throw error;
  }
};

/**
 * Share user profile
 * @param {Object} profile - User profile data
 * @param {Object} options - Share options
 * @returns {Promise<Object>} Share result
 */
export const shareProfile = async (profile, options = {}) => {
  try {
    const {
      uid,
      displayName,
      username,
      bio,
      photoURL,
    } = profile;
    
    // Prepare share text
    const shareText = options.message || 
      `Check out ${displayName || username}'s profile on HealthConnect. ${bio || ''}`;
    
    return await shareContent({
      title: options.title || `${displayName || username}'s Profile`,
      message: shareText,
      contentType: 'profile',
      contentId: uid,
      imageUrl: photoURL,
      ...options,
    });
  } catch (error) {
    console.error('Error sharing profile:', error);
    throw error;
  }
};

export default {
  SHARE_PLATFORM,
  shareContent,
  shareToSpecificPlatform,
  sharePostWithMedia,
  shareEvent,
  shareProfile,
  generateShareUrl,
};
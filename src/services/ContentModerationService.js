// src/services/ContentModerationService.js
// Content moderation service for filtering inappropriate content

import { AnalyticsService } from './AnalyticsService';
import Config from 'react-native-config';
import firestore from '@react-native-firebase/firestore';
import { Alert } from 'react-native';

// Configuration
const CONTENT_MODERATION_ENABLED = Config.CONTENT_MODERATION_ENABLED === 'true';
const AUTO_MODERATION_THRESHOLD = parseFloat(Config.AUTO_MODERATION_THRESHOLD || '0.8');

// Categories of content to moderate
const MODERATION_CATEGORIES = {
  PROFANITY: 'profanity',
  HARASSMENT: 'harassment',
  HATE_SPEECH: 'hate_speech',
  SEXUAL: 'sexual',
  VIOLENCE: 'violence',
  SELF_HARM: 'self_harm',
  ILLEGAL_ACTIVITY: 'illegal_activity',
};

class ContentModerationService {
  constructor() {
    this.initialized = false;
    this.moderationPatterns = {
      // Basic patterns to detect potentially problematic content
      // In a real application, you would use a more sophisticated service
      [MODERATION_CATEGORIES.PROFANITY]: [],
      [MODERATION_CATEGORIES.HARASSMENT]: [],
      [MODERATION_CATEGORIES.HATE_SPEECH]: [],
      [MODERATION_CATEGORIES.SEXUAL]: [],
      [MODERATION_CATEGORIES.VIOLENCE]: [],
      [MODERATION_CATEGORIES.SELF_HARM]: [],
      [MODERATION_CATEGORIES.ILLEGAL_ACTIVITY]: [],
    };
  }

  /**
   * Initialize the moderation service
   */
  async initialize() {
    if (this.initialized || !CONTENT_MODERATION_ENABLED) {
      return;
    }
    
    try {
      // In a real app, you would load moderation patterns from your backend
      // Here we're simulating by loading from Firestore
      const patternsDoc = await firestore().collection('settings').doc('moderation_patterns').get();
      
      if (patternsDoc.exists) {
        const patterns = patternsDoc.data();
        
        // Update local patterns with ones from server
        for (const category in MODERATION_CATEGORIES) {
          const categoryKey = MODERATION_CATEGORIES[category];
          if (patterns[categoryKey]) {
            this.moderationPatterns[categoryKey] = patterns[categoryKey];
          }
        }
      }
      
      this.initialized = true;
      
      AnalyticsService.logEvent('content_moderation_initialized', {
        success: true,
      });
      
      return true;
    } catch (error) {
      console.error('Error initializing content moderation:', error);
      AnalyticsService.logError(error, { context: 'initialize_content_moderation' });
      
      // Still mark as initialized to avoid repeated failures
      this.initialized = true;
      
      return false;
    }
  }
  
  /**
   * Moderate text content
   * @param {string} text The text content to moderate
   * @param {object} options Moderation options
   * @returns {object} Moderation result
   */
  moderateText(text, options = {}) {
    if (!CONTENT_MODERATION_ENABLED || !text) {
      return { isApproved: true, score: 0, categories: {} };
    }
    
    try {
      // Default options
      const opts = {
        userId: null,
        contentType: 'post',
        strictness: 'standard',
        ...options
      };
      
      // In a real application, you would call a proper content moderation API
      // Here we'll use a very basic approach with regex patterns
      
      const result = {
        isApproved: true,
        score: 0,
        categories: {},
        flagged: false,
        autoRejected: false,
        needsReview: false,
      };
      
      // Check each category
      for (const [category, patterns] of Object.entries(this.moderationPatterns)) {
        let categoryScore = 0;
        
        // Check each pattern in the category
        for (const pattern of patterns) {
          try {
            const regex = new RegExp(pattern.regex, 'i');
            
            if (regex.test(text)) {
              // Calculate a score based on the severity of the match
              categoryScore = Math.max(categoryScore, pattern.severity || 0.5);
            }
          } catch (regexError) {
            // Skip invalid regex patterns
            console.warn(`Invalid regex pattern in ${category}:`, regexError);
          }
        }
        
        // Store the category score
        result.categories[category] = categoryScore;
        
        // Update the overall score (use the max score across categories)
        result.score = Math.max(result.score, categoryScore);
      }
      
      // Determine the content status based on the score
      if (result.score >= AUTO_MODERATION_THRESHOLD) {
        result.isApproved = false;
        result.autoRejected = true;
        result.flagged = true;
      } else if (result.score >= 0.5) {
        // Contents with scores between 0.5 and threshold need human review
        result.needsReview = true;
        result.flagged = true;
      }
      
      // Log the moderation result for analytics
      if (result.score > 0) {
        AnalyticsService.logEvent('content_moderated', {
          contentType: opts.contentType,
          score: result.score,
          autoRejected: result.autoRejected,
          needsReview: result.needsReview,
          userId: opts.userId,
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error during text moderation:', error);
      AnalyticsService.logError(error, { 
        context: 'moderate_text',
        textLength: text?.length,
      });
      
      // In case of error, approve the content but flag for review
      return {
        isApproved: true,
        score: 0,
        needsReview: true,
        error: error.message,
      };
    }
  }
  
  /**
   * Moderate image content
   * @param {string} imageUri URI of the image to moderate
   * @param {object} options Moderation options
   * @returns {Promise<object>} Moderation result
   */
  async moderateImage(imageUri, options = {}) {
    if (!CONTENT_MODERATION_ENABLED || !imageUri) {
      return { isApproved: true, score: 0, categories: {} };
    }
    
    try {
      // Default options
      const opts = {
        userId: null,
        contentType: 'image',
        strictness: 'standard',
        ...options
      };
      
      // In a real application, you would upload the image to a content moderation API
      // Here we'll simulate by accepting all images
      
      // Simulate a network call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = {
        isApproved: true,
        score: 0,
        categories: {},
        flagged: false,
        autoRejected: false,
        needsReview: false,
      };
      
      // Log the moderation result for analytics
      AnalyticsService.logEvent('image_moderated', {
        contentType: opts.contentType,
        score: result.score,
        autoRejected: result.autoRejected,
        needsReview: result.needsReview,
        userId: opts.userId,
      });
      
      return result;
    } catch (error) {
      console.error('Error during image moderation:', error);
      AnalyticsService.logError(error, { 
        context: 'moderate_image',
        imageUri,
      });
      
      // In case of error, approve the content but flag for review
      return {
        isApproved: true,
        score: 0,
        needsReview: true,
        error: error.message,
      };
    }
  }
  
  /**
   * Report content for moderation
   * @param {object} content The content being reported
   * @param {string} reason The reason for reporting
   * @param {string} reportedBy ID of the user reporting the content
   * @returns {Promise<boolean>} Whether the report was successful
   */
  async reportContent(content, reason, reportedBy) {
    try {
      if (!content || !content.id || !reportedBy) {
        throw new Error('Invalid content or reporter information');
      }
      
      // Create a report in Firestore
      await firestore().collection('reports').add({
        contentId: content.id,
        contentType: content.type || 'unknown',
        contentOwnerId: content.userId || 'unknown',
        reportedBy,
        reason,
        timestamp: firestore.FieldValue.serverTimestamp(),
        status: 'pending',
      });
      
      // Log the report
      AnalyticsService.logEvent('content_reported', {
        contentType: content.type || 'unknown',
        contentId: content.id,
        reason,
      });
      
      // Show confirmation to user
      Alert.alert(
        'Report Submitted',
        'Thank you for reporting this content. Our team will review it shortly.',
        [{ text: 'OK' }]
      );
      
      return true;
    } catch (error) {
      console.error('Error reporting content:', error);
      AnalyticsService.logError(error, { 
        context: 'report_content',
        contentId: content?.id,
        reason,
      });
      
      // Show error to user
      Alert.alert(
        'Error Submitting Report',
        'There was a problem submitting your report. Please try again later.',
        [{ text: 'OK' }]
      );
      
      return false;
    }
  }
  
  /**
   * Get reporting reasons
   * @returns {Array<object>} List of reporting reasons
   */
  getReportingReasons() {
    return [
      { id: 'harassment', label: 'Harassment or bullying' },
      { id: 'hate_speech', label: 'Hate speech or discrimination' },
      { id: 'misinformation', label: 'False or misleading information' },
      { id: 'violence', label: 'Violence or threatening content' },
      { id: 'nudity', label: 'Nudity or sexual content' },
      { id: 'spam', label: 'Spam or scam' },
      { id: 'intellectual_property', label: 'Copyright or trademark violation' },
      { id: 'other', label: 'Other concern' },
    ];
  }
}

export default new ContentModerationService();

// src/services/ContentModerationService.js
// Handles content moderation, reports, and content filtering

import firestore from '@react-native-firebase/firestore';
import { Alert } from 'react-native';
import { withRetry } from './RetryService';

/**
 * Content Moderation Service
 * 
 * Provides automated and user-driven content moderation features:
 * - Profanity/harmful content filtering
 * - Medical misinformation detection
 * - User reporting system
 * - Admin moderation tools
 */
export const ContentModerationService = {
  // Banned terms and phrases - can be expanded or loaded from Firestore
  BANNED_TERMS: [
    // Profanity and harmful content
    'badword1', 'badword2', 
    // Medical misinformation keywords (examples)
    'proven cure for all cancer', 'miracle treatment', 'guaranteed cure'
  ],
  
  /**
   * Check text for policy violations
   * 
   * @param {string} text - Text to check
   * @returns {Object} Result with status and details
   */
  checkContentPolicy: (text) => {
    if (!text) return { passed: true };
    
    const lowerText = text.toLowerCase();
    const foundTerms = [];
    
    // Check for banned terms
    ContentModerationService.BANNED_TERMS.forEach(term => {
      if (lowerText.includes(term.toLowerCase())) {
        foundTerms.push(term);
      }
    });
    
    // Return results
    if (foundTerms.length > 0) {
      return {
        passed: false,
        reason: 'Content contains potentially harmful or inappropriate language',
        terms: foundTerms
      };
    }
    
    return { passed: true };
  },
  
  /**
   * Submit a report for moderation
   * 
   * @param {Object} reportData - Report data
   * @returns {Promise<string>} Report ID
   */
  submitReport: async (reportData) => {
    try {
      const reportRef = await withRetry(() => 
        firestore().collection('reports').add({
          ...reportData,
          status: 'pending',
          timestamp: firestore.FieldValue.serverTimestamp(),
          reviewed: false,
          reviewedBy: null,
          reviewTimestamp: null
        })
      );
      
      return reportRef.id;
    } catch (error) {
      console.error('Error submitting report:', error);
      throw new Error('Failed to submit report. Please try again.');
    }
  },
  
  /**
   * Report a post
   * 
   * @param {string} postId - Post ID
   * @param {string} reporterId - Reporter user ID
   * @param {string} reason - Reason for reporting
   * @param {string} additionalInfo - Additional information
   * @returns {Promise<string>} Report ID
   */
  reportPost: async (postId, reporterId, reason, additionalInfo = '') => {
    try {
      // Get post data for reference
      const postDoc = await firestore().collection('posts').doc(postId).get();
      
      if (!postDoc.exists) {
        throw new Error('Post not found');
      }
      
      const postData = postDoc.data();
      
      const reportData = {
        type: 'post',
        contentId: postId,
        contentOwnerId: postData.userId,
        reporterId,
        reason,
        additionalInfo,
      };
      
      return await ContentModerationService.submitReport(reportData);
    } catch (error) {
      console.error('Error reporting post:', error);
      throw error;
    }
  },
  
  /**
   * Report a comment
   * 
   * @param {string} commentId - Comment ID
   * @param {string} postId - Associated post ID
   * @param {string} reporterId - Reporter user ID
   * @param {string} reason - Reason for reporting
   * @param {string} additionalInfo - Additional information
   * @returns {Promise<string>} Report ID
   */
  reportComment: async (commentId, postId, reporterId, reason, additionalInfo = '') => {
    try {
      // Get comment data for reference
      const commentDoc = await firestore().collection('comments').doc(commentId).get();
      
      if (!commentDoc.exists) {
        throw new Error('Comment not found');
      }
      
      const commentData = commentDoc.data();
      
      const reportData = {
        type: 'comment',
        contentId: commentId,
        postId,
        contentOwnerId: commentData.userId,
        reporterId,
        reason,
        additionalInfo,
      };
      
      return await ContentModerationService.submitReport(reportData);
    } catch (error) {
      console.error('Error reporting comment:', error);
      throw error;
    }
  },
  
  /**
   * Report a user
   * 
   * @param {string} userId - User ID to report
   * @param {string} reporterId - Reporter user ID
   * @param {string} reason - Reason for reporting
   * @param {string} additionalInfo - Additional information
   * @returns {Promise<string>} Report ID
   */
  reportUser: async (userId, reporterId, reason, additionalInfo = '') => {
    try {
      // Validate user exists
      const userDoc = await firestore().collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        throw new Error('User not found');
      }
      
      const reportData = {
        type: 'user',
        contentId: userId,
        contentOwnerId: userId,
        reporterId,
        reason,
        additionalInfo,
      };
      
      return await ContentModerationService.submitReport(reportData);
    } catch (error) {
      console.error('Error reporting user:', error);
      throw error;
    }
  },
  
  /**
   * Get the reporting history for a user
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Reporting history
   */
  getUserReportingHistory: async (userId) => {
    try {
      const reportsSnapshot = await withRetry(() =>
        firestore()
          .collection('reports')
          .where('reporterId', '==', userId)
          .orderBy('timestamp', 'desc')
          .get()
      );
      
      return reportsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || null,
        reviewTimestamp: doc.data().reviewTimestamp?.toDate() || null,
      }));
    } catch (error) {
      console.error('Error getting user reporting history:', error);
      throw new Error('Failed to retrieve reporting history');
    }
  },
  
  /**
   * Get reports for a specific content item
   * 
   * @param {string} contentId - Content ID (post, comment, or user ID)
   * @returns {Promise<Array>} Reports for the content
   */
  getContentReports: async (contentId) => {
    try {
      const reportsSnapshot = await withRetry(() =>
        firestore()
          .collection('reports')
          .where('contentId', '==', contentId)
          .orderBy('timestamp', 'desc')
          .get()
      );
      
      return reportsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || null,
        reviewTimestamp: doc.data().reviewTimestamp?.toDate() || null,
      }));
    } catch (error) {
      console.error('Error getting content reports:', error);
      throw new Error('Failed to retrieve content reports');
    }
  },
  
  /**
   * Moderate content (for admin use)
   * 
   * @param {string} reportId - Report ID
   * @param {Object} action - Moderation action
   * @returns {Promise<void>}
   */
  moderateContent: async (reportId, action) => {
    try {
      // This would be an admin function to take action based on a report
      // Example: Remove content, warn user, ban user, etc.
      const reportDoc = await firestore().collection('reports').doc(reportId).get();
      
      if (!reportDoc.exists) {
        throw new Error('Report not found');
      }
      
      const reportData = reportDoc.data();
      const { contentId, type } = reportData;
      
      // Action is an object that might contain:
      // action.decision: 'remove', 'warn', 'ignore', etc.
      // action.moderatorId: ID of the admin/moderator
      // action.notes: Notes from the moderator
      
      // Start a batch operation for atomicity
      const batch = firestore().batch();
      
      // Update the report status
      batch.update(reportDoc.ref, {
        status: action.decision,
        reviewed: true,
        reviewedBy: action.moderatorId,
        reviewTimestamp: firestore.FieldValue.serverTimestamp(),
        moderatorNotes: action.notes || null
      });
      
      // Take appropriate action based on type and decision
      if (action.decision === 'remove') {
        if (type === 'post') {
          const postRef = firestore().collection('posts').doc(contentId);
          batch.update(postRef, {
            removed: true,
            removalReason: action.reason || 'Violation of community guidelines',
            removedAt: firestore.FieldValue.serverTimestamp(),
            removedBy: action.moderatorId
          });
        } else if (type === 'comment') {
          const commentRef = firestore().collection('comments').doc(contentId);
          batch.update(commentRef, {
            removed: true,
            removalReason: action.reason || 'Violation of community guidelines',
            removedAt: firestore.FieldValue.serverTimestamp(),
            removedBy: action.moderatorId
          });
        } else if (type === 'user') {
          // For user moderation - could suspend account
          const userRef = firestore().collection('users').doc(contentId);
          batch.update(userRef, {
            suspended: true,
            suspensionReason: action.reason || 'Violation of community guidelines',
            suspendedAt: firestore.FieldValue.serverTimestamp(),
            suspendedBy: action.moderatorId,
            suspensionDuration: action.duration || null // Could be null for indefinite
          });
        }
      }
      
      // Commit all changes
      await batch.commit();
      
      return true;
    } catch (error) {
      console.error('Error moderating content:', error);
      throw new Error('Failed to moderate content');
    }
  },
  
  /**
   * Show a report dialog to the user
   * 
   * @param {Object} options - Report options
   * @returns {Promise<string|null>} Report ID or null if cancelled
   */
  showReportDialog: (options) => {
    const { 
      type, 
      contentId, 
      postId, 
      userId, 
      onSubmit, 
      onCancel 
    } = options;
    
    // Define report reasons based on content type
    const reasons = {
      post: [
        'Misinformation',
        'Harmful or dangerous content',
        'Spam',
        'Hateful or abusive content',
        'Violent or graphic content',
        'Harassment or bullying',
        'Inappropriate medical advice',
        'Other'
      ],
      comment: [
        'Harassment or bullying',
        'Hateful or abusive content',
        'Misinformation',
        'Spam',
        'Inappropriate medical advice',
        'Other'
      ],
      user: [
        'Fake profile',
        'Harassment or bullying',
        'Impersonation',
        'Spam',
        'Inappropriate content sharing',
        'Other'
      ]
    };
    
    // Show an alert dialog with report options
    Alert.alert(
      'Report',
      `Why are you reporting this ${type}?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        {
          text: 'Continue',
          onPress: () => {
            // This would typically open a more detailed form
            // For simplicity, we're using an alert here
            Alert.alert(
              'Select a reason',
              '',
              [
                ...reasons[type].map(reason => ({
                  text: reason,
                  onPress: async () => {
                    try {
                      let reportId;
                      
                      switch (type) {
                        case 'post':
                          reportId = await ContentModerationService.reportPost(
                            contentId,
                            userId,
                            reason
                          );
                          break;
                        case 'comment':
                          reportId = await ContentModerationService.reportComment(
                            contentId,
                            postId,
                            userId,
                            reason
                          );
                          break;
                        case 'user':
                          reportId = await ContentModerationService.reportUser(
                            contentId,
                            userId,
                            reason
                          );
                          break;
                      }
                      
                      if (onSubmit) onSubmit(reportId, reason);
                      
                      Alert.alert(
                        'Thank You',
                        'Your report has been submitted and will be reviewed by our team.',
                        [{ text: 'OK' }]
                      );
                    } catch (error) {
                      Alert.alert('Error', 'Failed to submit report. Please try again.');
                    }
                  }
                })),
                { text: 'Cancel', style: 'cancel' }
              ]
            );
          }
        }
      ]
    );
    
    // This function doesn't return a value directly, as it uses callbacks
    // The reportId will be provided to the onSubmit callback
    return null;
  }
};

// Usage example:
/*
import { ContentModerationService } from '../services/ContentModerationService';

// Check content before posting
const validatePost = (postText) => {
  const checkResult = ContentModerationService.checkContentPolicy(postText);
  if (!checkResult.passed) {
    Alert.alert('Content Warning', checkResult.reason);
    return false;
  }
  return true;
};

// Report a post
const handleReportPost = (postId) => {
  ContentModerationService.showReportDialog({
    type: 'post',
    contentId: postId,
    userId: auth().currentUser.uid,
    onSubmit: (reportId, reason) => {
      console.log(`Report ${reportId} submitted successfully`);
    }
  });
};
*/

export default ContentModerationService;

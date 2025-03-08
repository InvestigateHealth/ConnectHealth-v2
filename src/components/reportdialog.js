// src/components/ReportDialog.js
// Modal for reporting content with reason selection - Improved with better error handling

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { ContentModerationService } from '../services/ContentModerationService';

const ReportDialog = ({ 
  visible, 
  onClose, 
  contentType = 'post', 
  contentId,
  postId,
  reporterId,
  onSuccess 
}) => {
  const { theme } = useTheme();
  const [step, setStep] = useState(1); // 1: Select reason, 2: Additional details
  const [selectedReason, setSelectedReason] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when dialog is closed
  const resetState = useCallback(() => {
    setStep(1);
    setSelectedReason('');
    setAdditionalInfo('');
    setError(null);
  }, []);

  // Define report reasons based on content type
  const getReasons = useCallback(() => {
    switch(contentType) {
      case 'post':
        return [
          'Misinformation',
          'Harmful or dangerous content',
          'Spam',
          'Hateful or abusive content', 
          'Violent or graphic content',
          'Harassment or bullying',
          'Inappropriate medical advice',
          'Other'
        ];
      case 'comment':
        return [
          'Harassment or bullying',
          'Hateful or abusive content',
          'Misinformation',
          'Spam',
          'Inappropriate medical advice',
          'Other'
        ];
      case 'user':
        return [
          'Fake profile',
          'Harassment or bullying',
          'Impersonation',
          'Spam',
          'Inappropriate content sharing',
          'Other'
        ];
      default:
        return ['Other'];
    }
  }, [contentType]);

  const handleReasonSelect = (reason) => {
    setSelectedReason(reason);
    setStep(2);
  };

  const validateSubmission = () => {
    if (!contentId) {
      setError('Missing content ID');
      return false;
    }
    
    if (!reporterId) {
      setError('Unable to identify reporter');
      return false;
    }
    
    if (contentType === 'comment' && !postId) {
      setError('Missing post ID for comment report');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateSubmission()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      let reportId;
      
      switch (contentType) {
        case 'post':
          reportId = await ContentModerationService.reportPost(
            contentId,
            reporterId,
            selectedReason,
            additionalInfo
          );
          break;
        case 'comment':
          reportId = await ContentModerationService.reportComment(
            contentId,
            postId,
            reporterId,
            selectedReason,
            additionalInfo
          );
          break;
        case 'user':
          reportId = await ContentModerationService.reportUser(
            contentId,
            reporterId,
            selectedReason,
            additionalInfo
          );
          break;
        default:
          throw new Error(`Unsupported content type: ${contentType}`);
      }
      
      // Only call onSuccess if it exists and we have a valid reportId
      if (reportId && typeof onSuccess === 'function') {
        onSuccess(reportId, selectedReason);
      }
      
      handleClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      setError(`Failed to submit report: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 2) {
      setStep(1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const renderStepOne = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.instruction, { color: theme.colors.text.primary }]}>
        Why are you reporting this {contentType}?
      </Text>
      
      <ScrollView style={styles.reasonsContainer}>
        {getReasons().map((reason, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.reasonItem,
              { backgroundColor: theme.colors.background.input }
            ]}
            onPress={() => handleReasonSelect(reason)}
            accessibilityRole="button"
            accessibilityLabel={`Report for ${reason}`}
            accessibilityHint={`Select ${reason} as the reason for reporting`}
          >
            <Text style={[styles.reasonText, { color: theme.colors.text.primary }]}>
              {reason}
            </Text>
            <Icon name="chevron-forward" size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderStepTwo = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
      style={styles.stepContainer}
    >
      <Text style={[styles.instruction, { color: theme.colors.text.primary }]}>
        Please provide any additional details
      </Text>
      
      <Text style={[styles.reasonSummary, { color: theme.colors.primary.main }]}>
        Reason: {selectedReason}
      </Text>
      
      <TextInput
        style={[
          styles.input,
          { 
            color: theme.colors.text.primary,
            backgroundColor: theme.colors.background.input,
            borderColor: error ? theme.colors.error.main : theme.colors.divider
          }
        ]}
        placeholder="Add more details about this report (optional)"
        placeholderTextColor={theme.colors.text.hint}
        multiline
        textAlignVertical="top"
        value={additionalInfo}
        onChangeText={setAdditionalInfo}
        maxLength={500}
      />
      
      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error.main }]}>
          {error}
        </Text>
      )}
      
      <Text style={[styles.privacyNote, { color: theme.colors.text.secondary }]}>
        Your report will be kept confidential and reviewed by our moderation team.
      </Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: theme.colors.primary.main }
          ]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Submit report"
          accessibilityState={{ disabled: isSubmitting }}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Report</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleBack}
    >
      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.container}>
          <View style={[styles.content, { backgroundColor: theme.colors.background.paper }]}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel={step === 1 ? "Close report dialog" : "Go back to reason selection"}
              >
                <Icon 
                  name={step === 1 ? "close" : "arrow-back"} 
                  size={24} 
                  color={theme.colors.text.primary} 
                />
              </TouchableOpacity>
              
              <Text style={[styles.title, { color: theme.colors.text.primary }]}>
                Report {contentType.charAt(0).toUpperCase() + contentType.slice(1)}
              </Text>
            </View>
            
            {step === 1 ? renderStepOne() : renderStepTwo()}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  stepContainer: {
    padding: 16,
    flex: 1,
  },
  instruction: {
    fontSize: 16,
    marginBottom: 16,
  },
  reasonsContainer: {
    marginBottom: 16,
  },
  reasonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 16,
  },
  reasonSummary: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  input: {
    height: 120,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
  },
  privacyNote: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  submitButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
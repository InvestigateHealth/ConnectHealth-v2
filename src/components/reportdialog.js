// src/components/ReportDialog.js
// Modal for reporting content with reason selection

import React, { useState } from 'react';
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
  Platform
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

  // Define report reasons based on content type
  const getReasons = () => {
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
  };

  const handleReasonSelect = (reason) => {
    setSelectedReason(reason);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!contentId || !reporterId) return;
    
    setIsSubmitting(true);
    
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
      }
      
      if (onSuccess) {
        onSuccess(reportId, selectedReason);
      }
      
      handleClose();
    } catch (error) {
      console.error('Error submitting report:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedReason('');
    setAdditionalInfo('');
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
      behavior={Platform.OS === 'ios' ? 'padding' : null}
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
            borderColor: theme.colors.divider
          }
        ]}
        placeholder="Add more details about this report (optional)"
        placeholderTextColor={theme.colors.text.hint}
        multiline
        textAlignVertical="top"
        value={additionalInfo}
        onChangeText={setAdditionalInfo}
      />
      
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
      <View style={styles.container}>
        <View style={[styles.content, { backgroundColor: theme.colors.background.paper }]}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
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
    </Modal>
  );
};

const styles = StyleSheet.create({
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

export default ReportDialog;

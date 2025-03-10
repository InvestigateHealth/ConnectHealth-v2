// src/components/UserBlock.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useBlockedUsers } from '../contexts/BlockedUsersContext';
import { useTheme } from '../theme/ThemeContext';
import { AnalyticsService } from '../services/AnalyticsService';

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam', description: 'Posting unwanted or repetitive content' },
  { id: 'harassment', label: 'Harassment', description: 'Bullying, threatening, or intimidating behavior' },
  { id: 'inappropriate', label: 'Inappropriate content', description: 'Posting offensive, explicit, or harmful content' },
  { id: 'impersonation', label: 'Impersonation', description: 'Pretending to be someone else' },
  { id: 'misinformation', label: 'Misinformation', description: 'Sharing false or misleading information' },
  { id: 'other', label: 'Other', description: 'Any other reason not listed above' },
];

const UserBlock = ({ userId, userName, onComplete, fromContentId }) => {
  const { blockUser, isUserBlocked } = useBlockedUsers();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState(null);
  const { theme } = useTheme();

  const isBlocked = isUserBlocked(userId);

  const handleBlockUser = async () => {
    if (!userId) return;
    
    // First ask for confirmation
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${userName || 'this user'}? You won't see their content anymore.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await blockUser(userId);
              Alert.alert(
                'User Blocked',
                `You have successfully blocked ${userName || 'this user'}.`,
                [{ text: 'OK' }]
              );
              
              // Log the block event
              AnalyticsService.logEvent('user_blocked', {
                blocked_user_id: userId,
                from_content_id: fromContentId,
                report_reason: null,
              });
              
              if (onComplete) onComplete();
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user. Please try again later.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReportUser = () => {
    setIsModalVisible(true);
  };

  const submitReport = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for reporting this user.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Send report to backend
      // This would typically be implemented in a separate service
      // For now, we'll just log it and block the user
      
      // Log the report
      AnalyticsService.logEvent('user_reported', {
        reported_user_id: userId,
        from_content_id: fromContentId,
        report_reason: selectedReason,
      });
      
      // Also block the user
      await blockUser(userId);
      
      // Success message
      setIsModalVisible(false);
      Alert.alert(
        'Report Submitted',
        `Thank you for your report. ${userName || 'This user'} has also been blocked.`,
        [{ text: 'OK' }]
      );
      
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error reporting user:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={[
            styles.button,
            isBlocked ? styles.disabledButton : styles.blockButton,
            { borderColor: theme?.colors?.error?.main || '#d32f2f' }
          ]}
          onPress={handleBlockUser}
          disabled={isBlocked || loading}
        >
          <Icon
            name={isBlocked ? 'user-x' : 'user-minus'}
            size={16}
            color={isBlocked ? '#999999' : (theme?.colors?.error?.main || '#d32f2f')}
          />
          <Text
            style={[
              styles.buttonText,
              isBlocked ? styles.disabledText : { color: theme?.colors?.error?.main || '#d32f2f' }
            ]}
          >
            {isBlocked ? 'Blocked' : 'Block User'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.reportButton,
            { borderColor: theme?.colors?.warning?.main || '#ed6c02' }
          ]}
          onPress={handleReportUser}
          disabled={loading}
        >
          <Icon
            name="flag"
            size={16}
            color={theme?.colors?.warning?.main || '#ed6c02'}
          />
          <Text
            style={[
              styles.buttonText,
              { color: theme?.colors?.warning?.main || '#ed6c02' }
            ]}
          >
            Report
          </Text>
        </TouchableOpacity>
      </View>

      {/* Report Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme?.colors?.background?.paper || '#FFFFFF' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme?.colors?.text?.primary || '#000000' }]}>
                Report {userName || 'User'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Icon name="x" size={24} color={theme?.colors?.text?.secondary || '#666666'} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalDescription, { color: theme?.colors?.text?.secondary || '#666666' }]}>
              Please select a reason for reporting this user:
            </Text>
            
            <ScrollView style={styles.reasonsContainer}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonItem,
                    selectedReason === reason.id && {
                      backgroundColor: `${theme?.colors?.primary?.light || '#e3f2fd'}50`
                    }
                  ]}
                  onPress={() => setSelectedReason(reason.id)}
                >
                  <View style={styles.reasonHeader}>
                    <Text style={[styles.reasonLabel, { color: theme?.colors?.text?.primary || '#000000' }]}>
                      {reason.label}
                    </Text>
                    {selectedReason === reason.id && (
                      <Icon name="check" size={18} color={theme?.colors?.primary?.main || '#007AFF'} />
                    )}
                  </View>
                  <Text style={[styles.reasonDescription, { color: theme?.colors?.text?.secondary || '#666666' }]}>
                    {reason.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsModalVisible(false)}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: theme?.colors?.primary?.main || '#007AFF' },
                  loading && styles.disabledButton,
                  !selectedReason && styles.disabledButton
                ]}
                onPress={submitReport}
                disabled={loading || !selectedReason}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 120,
    justifyContent: 'center',
  },
  blockButton: {
    backgroundColor: 'transparent',
  },
  reportButton: {
    backgroundColor: 'transparent',
  },
  disabledButton: {
    borderColor: '#CCCCCC',
    backgroundColor: '#F5F5F5',
  },
  buttonText: {
    marginLeft: 8,
    fontWeight: '500',
    fontSize: 14,
  },
  disabledText: {
    color: '#999999',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalDescription: {
    fontSize: 16,
    marginBottom: 16,
  },
  reasonsContainer: {
    maxHeight: 300,
  },
  reasonItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  reasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  reasonDescription: {
    fontSize: 14,
  },
  modalFooter: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  submitButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default UserBlock;
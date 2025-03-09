// src/components/BlockUserModal.js
// A reusable modal component for blocking users

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Keyboard,
  AccessibilityInfo,
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { useUser } from '../contexts/UserContext';
import * as Haptics from '../utils/haptics';
import { AnalyticsService } from '../services/AnalyticsService';

const BlockUserModal = ({ visible, onClose, userToBlock, onSuccess }) => {
  const { theme } = useTheme();
  const { blockUser } = useUser();
  
  const [blockReason, setBlockReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setBlockReason('');
      setCustomReason('');
      setLoading(false);
    }
  }, [visible]);
  
  // Handle keyboard showing/hiding
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);
  
  // Get user's display name
  const getUserName = () => {
    if (!userToBlock) return 'this user';
    return `${userToBlock.firstName || ''} ${userToBlock.lastName || ''}`.trim() || 'this user';
  };
  
  // Handle block submission
  const handleSubmitBlock = async () => {
    if (!userToBlock || loading) return;
    
    try {
      setLoading(true);
      Haptics.impactMedium();
      
      // Determine final reason based on selection
      const finalReason = blockReason === 'Other' && customReason.trim() 
        ? customReason.trim() 
        : blockReason;
      
      // Call block user function
      const success = await blockUser(userToBlock.id, finalReason);
      
      if (success) {
        // Log analytics event
        AnalyticsService.logEvent('block_user', { 
          userId: userToBlock.id,
          reason: finalReason
        });
        
        // Call success callback
        if (onSuccess) {
          onSuccess();
        }
        
        // Close modal
        onClose();
      } else {
        throw new Error('Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      // Let consuming component handle the error
      if (onSuccess) {
        onSuccess(error);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Announce modal for screen readers when it becomes visible
  useEffect(() => {
    if (visible) {
      const message = `Block ${getUserName()} dialog opened`;
      
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(message);
      } else {
        // For Android
        setTimeout(() => {
          AccessibilityInfo.announceForAccessibility(message);
        }, 500);
      }
    }
  }, [visible, userToBlock]);
  
  // Select a reason option
  const selectReasonOption = (reason) => {
    setBlockReason(reason);
    Haptics.selectionLight();
  };
  
  // Render each reason option
  const renderReasonOption = (reason, label) => (
    <TouchableOpacity 
      style={[
        styles.reasonOption,
        blockReason === reason && [
          styles.selectedReasonOption,
          { backgroundColor: theme.colors.primary.lightest }
        ]
      ]}
      onPress={() => selectReasonOption(reason)}
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: blockReason === reason }}
    >
      <Text style={[
        styles.reasonText,
        blockReason === reason && { color: theme.colors.primary.main }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
  
  if (!visible) return null;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContainer,
          { backgroundColor: theme.colors.background.paper },
          keyboardVisible && styles.modalWithKeyboard
        ]}>
          <View style={styles.modalHeader}>
            <Text style={[
              styles.modalTitle,
              { color: theme.colors.text.primary }
            ]}>
              Block {getUserName()}
            </Text>
            <TouchableOpacity 
              onPress={onClose}
              accessible={true}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Icon name="close" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={[
            styles.modalDescription,
            { color: theme.colors.text.secondary }
          ]}>
            When you block someone, they won't be able to follow you, view your posts, or interact with you. 
            They won't be notified that you blocked them.
          </Text>
          
          <Text style={[
            styles.reasonLabel,
            { color: theme.colors.text.primary }
          ]}>
            Reason for blocking (optional):
          </Text>
          
          <View style={styles.reasonOptions}>
            {renderReasonOption('Harassment', 'Harassment')}
            {renderReasonOption('Inappropriate Content', 'Inappropriate Content')}
            {renderReasonOption('Spam', 'Spam')}
            {renderReasonOption('Misinformation', 'Misinformation')}
            {renderReasonOption('Other', 'Other reason')}
          </View>
          
          {blockReason === 'Other' && (
            <TextInput
              style={[
                styles.customReasonInput,
                { 
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.background.input,
                  borderColor: theme.colors.divider 
                }
              ]}
              placeholder="Please specify a reason..."
              placeholderTextColor={theme.colors.text.hint}
              value={customReason}
              onChangeText={setCustomReason}
              maxLength={100}
              multiline
              accessible={true}
              accessibilityLabel="Custom reason for blocking"
              accessibilityHint="Enter your own reason for blocking this user"
              onSubmitEditing={Keyboard.dismiss}
            />
          )}
          
          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[
                styles.cancelButton,
                { borderColor: theme.colors.divider }
              ]}
              onPress={onClose}
              disabled={loading}
              accessible={true}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
            >
              <Text style={[
                styles.cancelButtonText,
                { color: theme.colors.text.primary }
              ]}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.blockButton,
                { backgroundColor: theme.colors.error.main },
                loading && { opacity: 0.7 }
              ]}
              onPress={handleSubmitBlock}
              disabled={loading}
              accessible={true}
              accessibilityLabel="Block User"
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.blockButtonText}>
                  Block User
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalWithKeyboard: {
    marginBottom: 120, // Adjust when keyboard is visible
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalDescription: {
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  reasonOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  reasonOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    margin: 4,
  },
  selectedReasonOption: {
    borderColor: 'transparent',
  },
  reasonText: {
    fontSize: 14,
  },
  customReasonInput: {
    height: 100,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  blockButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  blockButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BlockUserModal;
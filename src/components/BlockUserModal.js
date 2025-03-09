// src/components/BlockUserModal.js
// Modal component for blocking users

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../theme/ThemeContext';

const BlockUserModal = ({ visible, onClose, userToBlock, onSuccess }) => {
  const { theme } = useTheme();
  const { blockUser } = useUser();
  const [loading, setLoading] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  
  // Reset state when modal is closed
  React.useEffect(() => {
    if (!visible) {
      setBlockReason('');
      setLoading(false);
    }
  }, [visible]);
  
  // Get user display name
  const displayName = userToBlock 
    ? `${userToBlock.firstName || ''} ${userToBlock.lastName || ''}`.trim() || 'this user'
    : 'this user';
  
  // Handle block submission
  const handleSubmitBlock = async () => {
    if (loading || !userToBlock?.id) return;
    
    try {
      setLoading(true);
      
      const success = await blockUser(userToBlock.id, blockReason);
      
      if (success) {
        // Close modal first
        onClose();
        
        // Call success callback
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error('Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      Alert.alert('Error', 'Failed to block user. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
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
          { backgroundColor: theme.colors.background.paper }
        ]}>
          <View style={styles.modalHeader}>
            <Text style={[
              styles.modalTitle,
              { color: theme.colors.text.primary }
            ]}>
              Block {displayName}
            </Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Icon name="close" size={24} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={[
            styles.modalDescription,
            { color: theme.colors.text.secondary }
          ]}>
            When you block someone, they won't be able to follow you or view your posts.
            They also won't be notified that you blocked them.
          </Text>
          
          <Text style={[
            styles.reasonLabel,
            { color: theme.colors.text.primary }
          ]}>
            Reason for blocking (optional):
          </Text>
          
          <View style={styles.reasonOptions}>
            <TouchableOpacity 
              style={[
                styles.reasonOption,
                blockReason === 'Harassment' && [
                  styles.selectedReasonOption,
                  { backgroundColor: theme.colors.primary.lightest }
                ],
                { borderColor: theme.colors.divider }
              ]}
              onPress={() => setBlockReason('Harassment')}
              disabled={loading}
            >
              <Text style={[
                styles.reasonText,
                blockReason === 'Harassment' && { color: theme.colors.primary.main },
                { color: theme.colors.text.primary }
              ]}>
                Harassment
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.reasonOption,
                blockReason === 'Inappropriate Content' && [
                  styles.selectedReasonOption,
                  { backgroundColor: theme.colors.primary.lightest }
                ],
                { borderColor: theme.colors.divider }
              ]}
              onPress={() => setBlockReason('Inappropriate Content')}
              disabled={loading}
            >
              <Text style={[
                styles.reasonText,
                blockReason === 'Inappropriate Content' && { color: theme.colors.primary.main },
                { color: theme.colors.text.primary }
              ]}>
                Inappropriate Content
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.reasonOption,
                blockReason === 'Spam' && [
                  styles.selectedReasonOption,
                  { backgroundColor: theme.colors.primary.lightest }
                ],
                { borderColor: theme.colors.divider }
              ]}
              onPress={() => setBlockReason('Spam')}
              disabled={loading}
            >
              <Text style={[
                styles.reasonText,
                blockReason === 'Spam' && { color: theme.colors.primary.main },
                { color: theme.colors.text.primary }
              ]}>
                Spam
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.reasonOption,
                blockReason === 'Other' && [
                  styles.selectedReasonOption,
                  { backgroundColor: theme.colors.primary.lightest }
                ],
                { borderColor: theme.colors.divider }
              ]}
              onPress={() => setBlockReason('Other')}
              disabled={loading}
            >
              <Text style={[
                styles.reasonText,
                blockReason === 'Other' && { color: theme.colors.primary.main },
                { color: theme.colors.text.primary }
              ]}>
                Other
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[
                styles.cancelButton,
                { borderColor: theme.colors.divider }
              ]}
              onPress={onClose}
              disabled={loading}
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
    margin: 4,
  },
  selectedReasonOption: {
    borderColor: 'transparent',
  },
  reasonText: {
    fontSize: 14,
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
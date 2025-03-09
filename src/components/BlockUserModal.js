// src/components/BlockUserModal.js
// Modal component for blocking users

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { useUser } from '../contexts/UserContext';

const BlockUserModal = ({ visible, onClose, userToBlock, onSuccess }) => {
  const { theme } = useTheme();
  const { blockUser } = useUser();
  
  const [selectedReason, setSelectedReason] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Reset state when modal is opened/closed
  useEffect(() => {
    if (!visible) {
      setSelectedReason('');
      setLoading(false);
    }
  }, [visible]);

  // Available reasons for blocking
  const blockReasons = [
    'Harassment',
    'Inappropriate Content',
    'Spam',
    'Unwanted Contact',
    'Other'
  ];

  // Handle block user submission
  const handleBlockUser = async () => {
    if (!userToBlock?.id) return;
    
    try {
      setLoading(true);
      
      // Call blockUser function from UserContext
      const success = await blockUser(userToBlock.id, selectedReason);
      
      if (success) {
        onSuccess?.();
        onClose();
      } else {
        throw new Error('Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      // Handle error - in this case we'll just close the modal
      // since error handling would be done in the context
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Get formatted user name
  const getUserName = () => {
    if (!userToBlock) return 'this user';
    return `${userToBlock.firstName || ''} ${userToBlock.lastName || ''}`.trim() || 'this user';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
            <View style={[
              styles.container,
              { backgroundColor: theme.colors.background.paper }
            ]}>
              <View style={styles.header}>
                <Text style={[
                  styles.title,
                  { color: theme.colors.text.primary }
                ]}>
                  Block {getUserName()}?
                </Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 15, right: 15, bottom: 15, left: 15 }}>
                  <Icon name="close" size={24} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>
              
              <Text style={[
                styles.description,
                { color: theme.colors.text.secondary }
              ]}>
                When you block someone:
              </Text>
              
              <View style={styles.bulletPoints}>
                <View style={styles.bulletPoint}>
                  <Icon name="checkmark-circle" size={16} color={theme.colors.success.main} />
                  <Text style={[
                    styles.bulletText,
                    { color: theme.colors.text.primary }
                  ]}>
                    They won't be able to follow you or view your posts
                  </Text>
                </View>
                
                <View style={styles.bulletPoint}>
                  <Icon name="checkmark-circle" size={16} color={theme.colors.success.main} />
                  <Text style={[
                    styles.bulletText,
                    { color: theme.colors.text.primary }
                  ]}>
                    Their comments on your posts will be hidden
                  </Text>
                </View>
                
                <View style={styles.bulletPoint}>
                  <Icon name="checkmark-circle" size={16} color={theme.colors.success.main} />
                  <Text style={[
                    styles.bulletText,
                    { color: theme.colors.text.primary }
                  ]}>
                    They won't be notified that you blocked them
                  </Text>
                </View>
              </View>
              
              <Text style={[
                styles.reasonTitle,
                { color: theme.colors.text.primary }
              ]}>
                Reason for blocking (optional):
              </Text>
              
              <View style={styles.reasonContainer}>
                {blockReasons.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonOption,
                      selectedReason === reason && [
                        styles.selectedReason,
                        { backgroundColor: theme.colors.primary.lightest }
                      ],
                      { borderColor: theme.colors.divider }
                    ]}
                    onPress={() => setSelectedReason(reason)}
                  >
                    <Text style={[
                      styles.reasonText,
                      selectedReason === reason && { 
                        color: theme.colors.primary.main,
                        fontWeight: 'bold' 
                      },
                      { color: theme.colors.text.primary }
                    ]}>
                      {reason}
                    </Text>
                    {selectedReason === reason && (
                      <Icon 
                        name="checkmark-circle" 
                        size={18} 
                        color={theme.colors.primary.main} 
                        style={styles.checkIcon}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.footer}>
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
                    { backgroundColor: theme.colors.error.main }
                  ]}
                  onPress={handleBlockUser}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Icon name="ban-outline" size={18} color="white" style={styles.blockIcon} />
                      <Text style={styles.blockButtonText}>Block</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  bulletPoints: {
    marginBottom: 20,
  },
  bulletPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bulletText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    marginLeft: 10,
  },
  reasonTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  reasonContainer: {
    marginBottom: 20,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedReason: {
    borderColor: 'transparent',
  },
  reasonText: {
    fontSize: 15,
  },
  checkIcon: {
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  blockButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  blockButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  blockIcon: {
    marginRight: 8,
  },
});

export default BlockUserModal;

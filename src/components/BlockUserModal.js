// src/components/BlockUserModal.js
// Modal for blocking users with reason input - Updated with proper error handling and callback safety

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../theme/ThemeContext';

const BlockUserModal = ({ visible, onClose, userToBlock, onSuccess }) => {
  const { theme } = useTheme();
  const [reason, setReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [error, setError] = useState(null);
  const { blockUser } = useUser();

  const handleBlockUser = async () => {
    if (!userToBlock?.id) {
      setError('Invalid user information. Please try again.');
      return;
    }
    
    setIsBlocking(true);
    setError(null);
    
    try {
      const success = await blockUser(userToBlock.id, reason);
      
      if (success) {
        // Safely call onSuccess if it was provided
        if (typeof onSuccess === 'function') {
          onSuccess();
        }
        handleCancel(); // Reset and close modal
      } else {
        throw new Error('Failed to block user');
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      setError('Failed to block user. Please try again later.');
    } finally {
      setIsBlocking(false);
    }
  };

  const handleCancel = () => {
    setReason('');
    setError(null);
    onClose();
  };

  // Ensure userToBlock is valid
  const userDisplayName = userToBlock ? 
    `${userToBlock.name || 'this user'}` : 
    'this user';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.safeContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <TouchableOpacity 
            style={styles.backdrop} 
            activeOpacity={1} 
            onPress={handleCancel}
          />
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={[styles.content, { backgroundColor: theme.colors.background.paper }]}>
              <View style={styles.header}>
                <Icon name="shield-outline" size={24} color={theme.colors.error.main} />
                <Text style={[styles.title, { color: theme.colors.text.primary }]}>Block User</Text>
              </View>
              
              <Text style={[styles.description, { color: theme.colors.text.primary }]}>
                When you block {userDisplayName}, they won't be able to:
              </Text>
              
              <View style={styles.reasonsList}>
                <View style={styles.reasonItem}>
                  <Icon name="checkmark-circle" size={16} color={theme.colors.success.main} />
                  <Text style={[styles.reasonText, { color: theme.colors.text.primary }]}>See your posts</Text>
                </View>
                <View style={styles.reasonItem}>
                  <Icon name="checkmark-circle" size={16} color={theme.colors.success.main} />
                  <Text style={[styles.reasonText, { color: theme.colors.text.primary }]}>Comment on your content</Text>
                </View>
                <View style={styles.reasonItem}>
                  <Icon name="checkmark-circle" size={16} color={theme.colors.success.main} />
                  <Text style={[styles.reasonText, { color: theme.colors.text.primary }]}>Send you messages</Text>
                </View>
                <View style={styles.reasonItem}>
                  <Icon name="checkmark-circle" size={16} color={theme.colors.success.main} />
                  <Text style={[styles.reasonText, { color: theme.colors.text.primary }]}>Follow your account</Text>
                </View>
              </View>
              
              <Text style={[styles.optional, { color: theme.colors.text.primary }]}>Reason for blocking (optional):</Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    color: theme.colors.text.primary,
                    backgroundColor: theme.colors.background.input,
                    borderColor: error ? theme.colors.error.main : theme.colors.border
                  }
                ]}
                value={reason}
                onChangeText={setReason}
                placeholder="Enter reason for blocking..."
                placeholderTextColor={theme.colors.text.hint}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              
              {error && (
                <Text style={[styles.errorText, { color: theme.colors.error.main }]}>
                  {error}
                </Text>
              )}
              
              <Text style={[styles.note, { color: theme.colors.text.secondary }]}>
                This information is for your reference only and will not be shared.
              </Text>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                  disabled={isBlocking}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  accessibilityHint="Cancels blocking this user"
                >
                  <Text style={[
                    styles.cancelButtonText,
                    { color: theme.colors.text.secondary }
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
                  disabled={isBlocking}
                  accessibilityRole="button"
                  accessibilityLabel="Block user"
                  accessibilityHint={`Blocks ${userDisplayName} from interacting with you`}
                >
                  {isBlocking ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.blockButtonText}>Block</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  description: {
    fontSize: 16,
    marginBottom: 16,
  },
  reasonsList: {
    marginBottom: 16,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 14,
    marginLeft: 8,
  },
  optional: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  note: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  blockButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  blockButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
});

export default BlockUserModal;
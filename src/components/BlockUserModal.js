// src/components/BlockUserModal.js
// Modal for blocking users with reason input - Updated with proper Firebase integration

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../theme/ThemeContext';

const BlockUserModal = ({ visible, onClose, userToBlock, onSuccess }) => {
  const { theme } = useTheme();
  const [reason, setReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const { blockUser } = useUser();

  const handleBlockUser = async () => {
    if (!userToBlock) return;
    
    setIsBlocking(true);
    
    try {
      const success = await blockUser(userToBlock.id, reason);
      
      if (success) {
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      console.error('Error blocking user:', error);
    } finally {
      setIsBlocking(false);
    }
  };

  const handleCancel = () => {
    setReason('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        <View style={[styles.content, { backgroundColor: theme.colors.background.paper }]}>
          <View style={styles.header}>
            <Icon name="shield-outline" size={24} color={theme.colors.error.main} />
            <Text style={[styles.title, { color: theme.colors.text.primary }]}>Block User</Text>
          </View>
          
          <Text style={[styles.description, { color: theme.colors.text.primary }]}>
            When you block someone, they won't be able to:
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
                borderColor: theme.colors.border
              }
            ]}
            value={reason}
            onChangeText={setReason}
            placeholder="Enter reason for blocking..."
            placeholderTextColor={theme.colors.text.hint}
            multiline
            maxLength={500}
          />
          
          <Text style={[styles.note, { color: theme.colors.text.secondary }]}>
            This information is for your reference only and will not be shared.
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={isBlocking}
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
            >
              {isBlocking ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.blockButtonText}>Block</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
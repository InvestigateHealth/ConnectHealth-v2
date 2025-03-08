// src/services/ChatService.js
// Real-time chat functionality using Firestore

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Alert } from 'react-native';

class ChatService {
  // Initialize the chat service
  constructor() {
    this.currentUser = null;
    this.messageListeners = {};
    this.conversationListeners = {};
    this.typingStatusListeners = {};
  }

  // Set current user reference
  setCurrentUser(user) {
    this.currentUser = user;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser || auth().currentUser;
  }

  // Clean up all listeners
  cleanup() {
    // Clean up message listeners
    Object.values(this.messageListeners).forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.messageListeners = {};

    // Clean up conversation listeners
    Object.values(this.conversationListeners).forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.conversationListeners = {};

    // Clean up typing status listeners
    Object.values(this.typingStatusListeners).forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.typingStatusListeners = {};
  }

  // Get all user conversations
  getConversations() {
    return new Promise(async (resolve, reject) => {
      try {
        const userId = this.getCurrentUser().uid;
        
        const snapshot = await firestore()
          .collection('conversations')
          .where('participants', 'array-contains', userId)
          .orderBy('lastMessageTimestamp', 'desc')
          .get();
        
        const conversations = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            lastMessageTimestamp: data.lastMessageTimestamp?.toDate() || null,
          };
        });
        
        resolve(conversations);
      } catch (error) {
        console.error('Error getting conversations:', error);
        reject(error);
      }
    });
  }

  // Listen to user's conversations in real-time
  listenToConversations(callback) {
    const userId = this.getCurrentUser().uid;
    
    // Clean up existing listener if any
    if (this.conversationListeners.main) {
      this.conversationListeners.main();
      delete this.conversationListeners.main;
    }
    
    // Create new listener
    this.conversationListeners.main = firestore()
      .collection('conversations')
      .where('participants', 'array-contains', userId)
      .orderBy('lastMessageTimestamp', 'desc')
      .onSnapshot(
        snapshot => {
          const conversations = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              lastMessageTimestamp: data.lastMessageTimestamp?.toDate() || null,
            };
          });
          
          callback(null, conversations);
        },
        error => {
          console.error('Error listening to conversations:', error);
          callback(error, null);
        }
      );
    
    // Return unsubscribe function
    return () => {
      if (this.conversationListeners.main) {
        this.conversationListeners.main();
        delete this.conversationListeners.main;
      }
    };
  }

  // Get conversation with a specific user (creates one if it doesn't exist)
  async getOrCreateConversation(otherUserId) {
    try {
      const userId = this.getCurrentUser().uid;
      
      // Check if conversation already exists
      const snapshot = await firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .get();
      
      // Find conversation with both participants
      const existingConversation = snapshot.docs.find(doc => {
        const participants = doc.data().participants || [];
        return participants.includes(otherUserId);
      });
      
      if (existingConversation) {
        return {
          id: existingConversation.id,
          ...existingConversation.data(),
          lastMessageTimestamp: existingConversation.data().lastMessageTimestamp?.toDate() || null,
        };
      }
      
      // Get user data for both participants
      const [currentUserDoc, otherUserDoc] = await Promise.all([
        firestore().collection('users').doc(userId).get(),
        firestore().collection('users').doc(otherUserId).get(),
      ]);
      
      if (!otherUserDoc.exists) {
        throw new Error('User not found');
      }
      
      const currentUserData = currentUserDoc.data();
      const otherUserData = otherUserDoc.data();
      
      // Create new conversation
      const conversationRef = await firestore().collection('conversations').add({
        participants: [userId, otherUserId],
        participantsData: {
          [userId]: {
            id: userId,
            name: `${currentUserData.firstName} ${currentUserData.lastName}`,
            profileImage: currentUserData.profileImageURL,
          },
          [otherUserId]: {
            id: otherUserId,
            name: `${otherUserData.firstName} ${otherUserData.lastName}`,
            profileImage: otherUserData.profileImageURL,
          },
        },
        created: firestore.FieldValue.serverTimestamp(),
        lastMessageTimestamp: null,
      });
      
      return {
        id: conversationRef.id,
        participants: [userId, otherUserId],
        participantsData: {
          [userId]: {
            id: userId,
            name: `${currentUserData.firstName} ${currentUserData.lastName}`,
            profileImage: currentUserData.profileImageURL,
          },
          [otherUserId]: {
            id: otherUserId,
            name: `${otherUserData.firstName} ${otherUserData.lastName}`,
            profileImage: otherUserData.profileImageURL,
          },
        },
        created: new Date(),
        lastMessageTimestamp: null,
      };
    } catch (error) {
      console.error('Error getting or creating conversation:', error);
      throw error;
    }
  }

  // Get messages for a conversation
  getMessages(conversationId, limit = 30) {
    return new Promise(async (resolve, reject) => {
      try {
        const snapshot = await firestore()
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();
        
        const messages = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || null,
          };
        });
        
        resolve(messages.reverse()); // Reverse for chronological order
      } catch (error) {
        console.error('Error getting messages:', error);
        reject(error);
      }
    });
  }

  // Listen to messages in a conversation in real-time
  listenToMessages(conversationId, callback) {
    // Clean up existing listener if any
    if (this.messageListeners[conversationId]) {
      this.messageListeners[conversationId]();
      delete this.messageListeners[conversationId];
    }
    
    const userId = this.getCurrentUser().uid;
    
    // Create new listener
    this.messageListeners[conversationId] = firestore()
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot(
        snapshot => {
          // Mark messages as read automatically
          const batch = firestore().batch();
          let hasUnreadMessages = false;
          
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added' || change.type === 'modified') {
              const message = change.doc.data();
              if (message.recipientId === userId && !message.read) {
                batch.update(change.doc.ref, { read: true });
                hasUnreadMessages = true;
              }
            }
          });
          
          if (hasUnreadMessages) {
            batch.commit().catch(error => {
              console.error('Error marking messages as read:', error);
            });
          }
          
          const messages = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || null,
            };
          });
          
          callback(null, messages);
        },
        error => {
          console.error('Error listening to messages:', error);
          callback(error, null);
        }
      );
    
    // Return unsubscribe function
    return () => {
      if (this.messageListeners[conversationId]) {
        this.messageListeners[conversationId]();
        delete this.messageListeners[conversationId];
      }
    };
  }

  // Send a message
  async sendMessage(conversationId, message) {
    try {
      const userId = this.getCurrentUser().uid;
      
      // Get conversation data
      const conversationDoc = await firestore()
        .collection('conversations')
        .doc(conversationId)
        .get();
      
      if (!conversationDoc.exists) {
        throw new Error('Conversation not found');
      }
      
      const conversationData = conversationDoc.data();
      const recipientId = conversationData.participants.find(id => id !== userId);
      
      if (!recipientId) {
        throw new Error('Recipient not found in conversation');
      }
      
      const userDataCached = conversationData.participantsData?.[userId];
      const recipientDataCached = conversationData.participantsData?.[recipientId];
      
      let userData = userDataCached;
      let recipientData = recipientDataCached;
      
      // If participant data is not cached, fetch it
      if (!userData || !recipientData) {
        const [userDoc, recipientDoc] = await Promise.all([
          firestore().collection('users').doc(userId).get(),
          firestore().collection('users').doc(recipientId).get(),
        ]);
        
        const userDocData = userDoc.data();
        const recipientDocData = recipientDoc.data();
        
        userData = {
          id: userId,
          name: `${userDocData.firstName} ${userDocData.lastName}`,
          profileImage: userDocData.profileImageURL,
        };
        
        recipientData = {
          id: recipientId,
          name: `${recipientDocData.firstName} ${recipientDocData.lastName}`,
          profileImage: recipientDocData.profileImageURL,
        };
        
        // Update the cached participant data in the conversation
        await firestore()
          .collection('conversations')
          .doc(conversationId)
          .update({
            [`participantsData.${userId}`]: userData,
            [`participantsData.${recipientId}`]: recipientData,
          });
      }
      
      // Create message data
      const messageData = {
        text: message.text,
        senderId: userId,
        senderName: userData.name,
        senderProfileImage: userData.profileImage,
        recipientId,
        recipientName: recipientData.name,
        timestamp: firestore.FieldValue.serverTimestamp(),
        read: false,
      };
      
      // If message has image, add it
      if (message.image) {
        messageData.image = message.image;
      }
      
      // Add message to conversation
      const messageRef = await firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .add(messageData);
      
      // Update conversation with last message info
      await firestore()
        .collection('conversations')
        .doc(conversationId)
        .update({
          lastMessage: message.text,
          lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
          lastMessageSenderId: userId,
          [`unreadCount.${recipientId}`]: firestore.FieldValue.increment(1),
        });
      
      // Create notification for recipient
      await firestore().collection('notifications').add({
        type: 'message',
        senderId: userId,
        senderName: userData.name,
        senderProfileImage: userData.profileImage,
        recipientId,
        conversationId,
        message: 'sent you a message',
        preview: message.text.substring(0, 50) + (message.text.length > 50 ? '...' : ''),
        timestamp: firestore.FieldValue.serverTimestamp(),
        read: false,
      });
      
      return {
        id: messageRef.id,
        ...messageData,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Update typing status for a conversation
  updateTypingStatus(conversationId, isTyping) {
    const userId = this.getCurrentUser().uid;
    
    return firestore()
      .collection('conversations')
      .doc(conversationId)
      .update({
        [`typingStatus.${userId}`]: isTyping ? new Date().getTime() : null,
      })
      .catch(error => {
        console.error('Error updating typing status:', error);
      });
  }

  // Listen to typing status changes
  listenToTypingStatus(conversationId, callback) {
    // Clean up existing listener if any
    if (this.typingStatusListeners[conversationId]) {
      this.typingStatusListeners[conversationId]();
      delete this.typingStatusListeners[conversationId];
    }
    
    const userId = this.getCurrentUser().uid;
    
    // Create new listener
    this.typingStatusListeners[conversationId] = firestore()
      .collection('conversations')
      .doc(conversationId)
      .onSnapshot(
        doc => {
          if (!doc.exists) {
            callback(null, {});
            return;
          }
          
          const data = doc.data();
          const typingStatus = data.typingStatus || {};
          
          // Filter out current user status
          const otherTypingStatus = {};
          Object.keys(typingStatus).forEach(key => {
            if (key !== userId) {
              otherTypingStatus[key] = typingStatus[key];
            }
          });
          
          callback(null, otherTypingStatus);
        },
        error => {
          console.error('Error listening to typing status:', error);
          callback(error, null);
        }
      );
    
    // Return unsubscribe function
    return () => {
      if (this.typingStatusListeners[conversationId]) {
        this.typingStatusListeners[conversationId]();
        delete this.typingStatusListeners[conversationId];
      }
    };
  }

  // Mark all messages in a conversation as read
  markConversationAsRead(conversationId) {
    const userId = this.getCurrentUser().uid;
    
    return new Promise(async (resolve, reject) => {
      try {
        // Get unread messages sent to this user
        const messagesSnapshot = await firestore()
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .where('recipientId', '==', userId)
          .where('read', '==', false)
          .get();
        
        if (messagesSnapshot.empty) {
          resolve({ count: 0 });
          return;
        }
        
        // Mark all as read
        const batch = firestore().batch();
        messagesSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, { read: true });
        });
        
        // Reset unread count for this user
        batch.update(
          firestore().collection('conversations').doc(conversationId),
          { [`unreadCount.${userId}`]: 0 }
        );
        
        await batch.commit();
        resolve({ count: messagesSnapshot.docs.length });
      } catch (error) {
        console.error('Error marking conversation as read:', error);
        reject(error);
      }
    });
  }

  // Delete a message
  deleteMessage(conversationId, messageId) {
    return firestore()
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .doc(messageId)
      .update({
        deleted: true,
        text: 'This message was deleted',
      })
      .catch(error => {
        console.error('Error deleting message:', error);
        throw error;
      });
  }

  // Delete entire conversation
  async deleteConversation(conversationId) {
    try {
      const userId = this.getCurrentUser().uid;
      
      // We don't actually delete the conversation, just set it as deleted for this user
      await firestore()
        .collection('conversations')
        .doc(conversationId)
        .update({
          [`deleted.${userId}`]: true,
        });
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  // Get total unread messages count
  async getUnreadMessagesCount() {
    try {
      const userId = this.getCurrentUser().uid;
      
      const snapshot = await firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .get();
      
      let totalUnread = 0;
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const unreadCount = data.unreadCount || {};
        totalUnread += unreadCount[userId] || 0;
      });
      
      return totalUnread;
    } catch (error) {
      console.error('Error getting unread messages count:', error);
      return 0;
    }
  }
}

// Export singleton instance
export default new ChatService();

// src/screens/ChatScreen.js
// Chat screen with real-time messaging

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import ChatService from '../services/ChatService';
import { pickAndProcessMedia } from '../utils/mediaProcessing';
import { useTheme } from '../theme/ThemeContext';
import { format } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';

const ChatScreen = ({ route, navigation }) => {
  const { conversationId, recipientId, recipientName } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [typingStatus, setTypingStatus] = useState({});
  const [isImagePickerVisible, setIsImagePickerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentConversationId, setCurrentConversationId] = useState(conversationId);
  
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  // Set up navigation options
  useEffect(() => {
    navigation.setOptions({
      title: recipientName || 'Chat',
      headerRight: () => (
        <TouchableOpacity
          style={{ marginRight: 15 }}
          onPress={() => {
            navigation.navigate('UserProfile', {
              userId: recipientId,
              title: recipientName,
            });
          }}
        >
          <Icon name="person" size={24} color={theme.colors.primary.main} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, recipientId, recipientName, theme]);
  
  // Initialize chat
  useEffect(() => {
    let unsubscribe = () => {};
    
    const initializeChat = async () => {
      try {
        // Get or create conversation
        let actualConversationId = conversationId;
        
        if (!conversationId && recipientId) {
          const conversation = await ChatService.getOrCreateConversation(recipientId);
          actualConversationId = conversation.id;
          setCurrentConversationId(conversation.id);
        }
        
        // Listen to messages
        unsubscribe = ChatService.listenToMessages(
          actualConversationId,
          (error, newMessages) => {
            if (error) {
              console.error('Error listening to messages:', error);
              return;
            }
            
            setMessages(newMessages);
            setIsLoading(false);
          }
        );
        
        // Mark conversation as read
        await ChatService.markConversationAsRead(actualConversationId);
      } catch (error) {
        console.error('Error initializing chat:', error);
        setIsLoading(false);
      }
    };
    
    initializeChat();
    
    // Clean up
    return () => {
      unsubscribe();
    };
  }, [conversationId, recipientId]);
  
  // Mark as read when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (currentConversationId) {
        ChatService.markConversationAsRead(currentConversationId);
      }
      
      return () => {};
    }, [currentConversationId])
  );
  
  // Listen to typing status
  useEffect(() => {
    let unsubscribe = () => {};
    
    if (currentConversationId) {
      unsubscribe = ChatService.listenToTypingStatus(
        currentConversationId,
        (error, status) => {
          if (error) {
            console.error('Error listening to typing status:', error);
            return;
          }
          
          setTypingStatus(status);
        }
      );
    }
    
    return () => {
      unsubscribe();
    };
  }, [currentConversationId]);
  
  // Handle typing indicator
  const handleTyping = () => {
    if (!currentConversationId) return;
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set typing status to true
    ChatService.updateTypingStatus(currentConversationId, true);
    
    // Automatically set to false after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      ChatService.updateTypingStatus(currentConversationId, false);
    }, 3000);
  };
  
  // Send a message
  const sendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;
    
    setIsSending(true);
    
    try {
      const messageData = {
        text: inputText.trim() || (selectedImage ? '[Image]' : ''),
      };
      
      // Add image if selected
      if (selectedImage) {
        messageData.image = selectedImage.uri;
      }
      
      await ChatService.sendMessage(currentConversationId, messageData);
      
      // Clear input
      setInputText('');
      setSelectedImage(null);
      
      // Clear typing status
      ChatService.updateTypingStatus(currentConversationId, false);
      
      // Scroll to bottom
      if (flatListRef.current) {
        setTimeout(() => {
          flatListRef.current.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };
  
  // Pick image
  const handleImagePick = async () => {
    try {
      const result = await pickAndProcessMedia({
        mediaType: 'photo',
        includeBase64: false,
        width: 1200,
        height: 1200,
        quality: 0.8,
      });
      
      if (result) {
        setSelectedImage(result);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };
  
  // Format date for messages
  const formatMessageTime = (date) => {
    if (!date) return '';
    return format(new Date(date), 'h:mm a');
  };
  
  // Format date for message groups
  const formatMessageDate = (date) => {
    if (!date) return '';
    
    const today = new Date();
    const messageDate = new Date(date);
    
    // Check if today
    if (
      messageDate.getDate() === today.getDate() &&
      messageDate.getMonth() === today.getMonth() &&
      messageDate.getFullYear() === today.getFullYear()
    ) {
      return 'Today';
    }
    
    // Check if yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      messageDate.getDate() === yesterday.getDate() &&
      messageDate.getMonth() === yesterday.getMonth() &&
      messageDate.getFullYear() === yesterday.getFullYear()
    ) {
      return 'Yesterday';
    }
    
    // Otherwise, return the date
    return format(messageDate, 'MMMM d, yyyy');
  };
  
  // Render a message item
  const renderMessageItem = ({ item, index }) => {
    const isCurrentUser = item.senderId === ChatService.getCurrentUser().uid;
    const showAvatar = !isCurrentUser && (index === 0 || messages[index - 1].senderId !== item.senderId);
    
    // Check if need to show date
    const showDate = index === 0 || 
      !isSameDay(
        new Date(messages[index - 1].timestamp), 
        new Date(item.timestamp)
      );
    
    return (
      <>
        {showDate && (
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>
              {formatMessageDate(item.timestamp)}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageContainer,
          isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
        ]}>
          {!isCurrentUser && showAvatar ? (
            <FastImage
              source={{ uri: item.senderProfileImage }}
              style={styles.avatar}
              defaultSource={require('../assets/default-avatar.png')}
            />
          ) : (
            <View style={styles.avatarPlaceholder} />
          )}
          
          <View style={[
            styles.messageBubble,
            isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble,
            item.image ? styles.imageBubble : {}
          ]}>
            {item.image && (
              <FastImage
                source={{ uri: item.image }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            )}
            
            {item.text && (
              <Text style={[
                styles.messageText,
                isCurrentUser ? styles.currentUserText : styles.otherUserText
              ]}>
                {item.text}
              </Text>
            )}
            
            <Text style={[
              styles.messageTime,
              isCurrentUser ? styles.currentUserTime : styles.otherUserTime
            ]}>
              {formatMessageTime(item.timestamp)}
              {isCurrentUser && item.read && (
                <Text style={styles.readIndicator}> ✓✓</Text>
              )}
            </Text>
          </View>
        </View>
      </>
    );
  };
  
  // Helper function to check if two dates are the same day
  const isSameDay = (date1, date2) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };
  
  // Render typing indicator
  const renderTypingIndicator = () => {
    const typingUsers = Object.keys(typingStatus).filter(
      userId => typingStatus[userId] && Date.now() - typingStatus[userId] < 10000
    );
    
    if (typingUsers.length === 0) return null;
    
    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <Text style={styles.typingText}>typing</Text>
          <View style={styles.typingDots}>
            <View style={[styles.typingDot, styles.typingDot1]} />
            <View style={[styles.typingDot, styles.typingDot2]} />
            <View style={[styles.typingDot, styles.typingDot3]} />
          </View>
        </View>
      </View>
    );
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={headerHeight + insets.bottom}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => {
              if (flatListRef.current && messages.length > 0) {
                flatListRef.current.scrollToEnd({ animated: false });
              }
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="chatbubble-ellipses-outline" size={80} color={theme.colors.gray[300]} />
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Start the conversation by sending a message</Text>
              </View>
            }
          />
          
          {renderTypingIndicator()}
          
          {selectedImage && (
            <View style={styles.selectedImageContainer}>
              <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setSelectedImage(null)}
              >
                <Icon name="close-circle" size={24} color={theme.colors.error.main} />
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={handleImagePick}
            >
              <Icon name="image-outline" size={24} color={theme.colors.primary.main} />
            </TouchableOpacity>
            
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={(text) => {
                setInputText(text);
                handleTyping();
              }}
              placeholder="Type a message..."
              placeholderTextColor={theme.colors.text.hint}
              multiline
              maxHeight={100}
            />
            
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() && !selectedImage) ? styles.sendButtonDisabled : {}
              ]}
              onPress={sendMessage}
              disabled={isSending || (!inputText.trim() && !selectedImage)}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Icon name="send" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#78909C',
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 16,
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateText: {
    fontSize: 12,
    color: '#78909C',
    backgroundColor: 'rgba(120, 144, 156, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  currentUserMessage: {
    justifyContent: 'flex-end',
  },
  otherUserMessage: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
    paddingBottom: 24,
    position: 'relative',
  },
  currentUserBubble: {
    backgroundColor: '#2196F3',
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
  },
  imageBubble: {
    padding: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  currentUserText: {
    color: '#FFFFFF',
  },
  otherUserText: {
    color: '#263238',
  },
  messageTime: {
    fontSize: 11,
    position: 'absolute',
    bottom: 6,
    right: 12,
  },
  currentUserTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherUserTime: {
    color: '#78909C',
  },
  readIndicator: {
    color: '#90CAF9',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  avatarPlaceholder: {
    width: 28,
    marginRight: 8,
  },
  typingContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  typingBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    fontSize: 12,
    color: '#78909C',
    marginRight: 4,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#78909C',
    margin: 1,
  },
  typingDot1: {
    animationName: 'bounce',
    animationDuration: '0.6s',
    animationIterationCount: 'infinite',
  },
  typingDot2: {
    animationName: 'bounce',
    animationDuration: '0.6s',
    animationDelay: '0.2s',
    animationIterationCount: 'infinite',
  },
  typingDot3: {
    animationName: 'bounce',
    animationDuration: '0.6s',
    animationDelay: '0.4s',
    animationIterationCount: 'infinite',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#ECEFF1',
  },
  attachButton: {
    padding: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F7F8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    color: '#263238',
    fontSize: 16,
    marginHorizontal: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B0BEC5',
  },
  selectedImageContainer: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#ECEFF1',
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#78909C',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#90A4AE',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default ChatScreen;
    
// src/services/ChatService.js
// Real-time chat functionality using Firestore with improved error handling and memory management

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Alert } from 'react-native';
import { withRetry, isRetriableError } from './RetryService';
import { isDeviceOnline } from './NetworkService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const MESSAGES_CACHE_PREFIX = 'chat_messages_';
const CONVERSATIONS_CACHE_KEY = 'chat_conversations';
const MESSAGE_BATCH_SIZE = 30;
const CACHE_RETENTION_DAYS = 7;

class ChatService {
  // Initialize the chat service
  constructor() {
    this.currentUser = null;
    this.messageListeners = {};
    this.conversationListeners = {};
    this.typingStatusListeners = {};
    this.pendingMessageQueue = [];
    this.isProcessingQueue = false;
    this.listenerErrorHandlers = {};
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
    
    // Clear other resources
    this.listenerErrorHandlers = {};
    this.pendingMessageQueue = [];
    this.isProcessingQueue = false;
  }
  
  /**
   * Initialize error handler for a specific listener
   * @param {string} listenerType - Type of listener ('message', 'conversation', 'typing')
   * @param {string} id - Identifier (e.g., conversationId)
   * @param {Function} callback - Callback to handle error
   */
  initializeErrorHandler(listenerType, id, callback) {
    const handlerId = `${listenerType}_${id}`;
    this.listenerErrorHandlers[handlerId] = callback;
  }
  
  /**
   * Handle listener error
   * @param {string} listenerType - Type of listener
   * @param {string} id - Identifier
   * @param {Error} error - The error that occurred
   */
  handleListenerError(listenerType, id, error) {
    console.error(`Error in ${listenerType} listener for ${id}:`, error);
    
    const handlerId = `${listenerType}_${id}`;
    const errorHandler = this.listenerErrorHandlers[handlerId];
    
    if (errorHandler && typeof errorHandler === 'function') {
      errorHandler(error);
    }
    
    // If it's a critical error, clean up the listener
    if (!isRetriableError(error)) {
      this.removeListener(listenerType, id);
    }
  }
  
  /**
   * Remove a specific listener
   * @param {string} listenerType - Type of listener
   * @param {string} id - Identifier
   */
  removeListener(listenerType, id) {
    const listenersMap = {
      'message': this.messageListeners,
      'conversation': this.conversationListeners,
      'typing': this.typingStatusListeners
    };
    
    const listenerMap = listenersMap[listenerType];
    if (listenerMap && listenerMap[id]) {
      if (typeof listenerMap[id] === 'function') {
        listenerMap[id]();
      }
      delete listenerMap[id];
    }
    
    const handlerId = `${listenerType}_${id}`;
    delete this.listenerErrorHandlers[handlerId];
  }

  /**
   * Get all user conversations with error handling and caching
   * @returns {Promise<Array>} Conversations list
   */
  async getConversations() {
    try {
      const userId = this.getCurrentUser()?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // Try to get cached conversations first
      const cachedData = await this.getCachedConversations();
      let conversations = [];
      
      // Check if we're online
      const isOnline = await isDeviceOnline();
      
      if (isOnline) {
        try {
          // Use withRetry for better reliability
          const snapshot = await withRetry(() => 
            firestore()
              .collection('conversations')
              .where('participants', 'array-contains', userId)
              .orderBy('lastMessageTimestamp', 'desc')
              .get()
          );
          
          conversations = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              lastMessageTimestamp: data.lastMessageTimestamp?.toDate() || null,
            };
          });
          
          // Cache the fresh data
          this.cacheConversations(conversations);
        } catch (error) {
          console.error('Error fetching conversations:', error);
          
          // If we have cached data, use it as fallback
          if (cachedData && cachedData.length > 0) {
            console.log('Using cached conversations data');
            conversations = cachedData;
          } else {
            throw error;
          }
        }
      } else if (cachedData && cachedData.length > 0) {
        // If offline and we have cached data, use it
        console.log('Offline mode: Using cached conversations data');
        conversations = cachedData;
      } else {
        throw new Error('Unable to load conversations while offline');
      }
      
      return conversations;
    } catch (error) {
      console.error('Error in getConversations:', error);
      throw error;
    }
  }

  /**
   * Cache conversations data
   * @param {Array} conversations - Conversations to cache
   */
  async cacheConversations(conversations) {
    try {
      if (!conversations || !Array.isArray(conversations)) return;
      
      const cacheData = {
        conversations,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching conversations:', error);
    }
  }

  /**
   * Get cached conversations
   * @returns {Promise<Array>} Cached conversations or empty array
   */
  async getCachedConversations() {
    try {
      const cacheString = await AsyncStorage.getItem(CONVERSATIONS_CACHE_KEY);
      if (!cacheString) return [];
      
      const cache = JSON.parse(cacheString);
      const cacheAge = Date.now() - cache.timestamp;
      
      // If cache is older than 7 days, consider it stale
      if (cacheAge > CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000) {
        return [];
      }
      
      return cache.conversations || [];
    } catch (error) {
      console.error('Error getting cached conversations:', error);
      return [];
    }
  }

  /**
   * Listen to user's conversations in real-time with improved error handling
   * @param {Function} callback - Callback function for conversations
   * @returns {Function} Unsubscribe function
   */
  listenToConversations(callback) {
    const userId = this.getCurrentUser()?.uid;
    if (!userId) {
      callback(new Error('User not authenticated'), null);
      return () => {};
    }
    
    // Clean up existing listener if any
    this.removeListener('conversation', 'main');
    
    // Initialize error handler
    this.initializeErrorHandler('conversation', 'main', (error) => {
      callback(error, null);
    });
    
    try {
      // Create new listener with error handling
      const unsubscribe = firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .orderBy('lastMessageTimestamp', 'desc')
        .onSnapshot(
          // Success handler
          snapshot => {
            try {
              const conversations = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  ...data,
                  lastMessageTimestamp: data.lastMessageTimestamp?.toDate() || null,
                };
              });
              
              // Cache conversations data
              this.cacheConversations(conversations);
              
              // Notify callback
              callback(null, conversations);
            } catch (error) {
              this.handleListenerError('conversation', 'main', error);
            }
          },
          // Error handler
          error => {
            this.handleListenerError('conversation', 'main', error);
          }
        );
      
      // Store unsubscribe function
      this.conversationListeners.main = unsubscribe;
      
      // Return unsubscribe function
      return () => {
        this.removeListener('conversation', 'main');
      };
    } catch (error) {
      console.error('Error setting up conversation listener:', error);
      callback(error, null);
      return () => {};
    }
  }
  /**
   * Get cached messages
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array>} Cached messages or empty array
   */
  async getCachedMessages(conversationId) {
    try {
      if (!conversationId) return [];
      
      const cacheKey = `${MESSAGES_CACHE_PREFIX}${conversationId}`;
      const cacheString = await AsyncStorage.getItem(cacheKey);
      
      if (!cacheString) return [];
      
      const cache = JSON.parse(cacheString);
      const cacheAge = Date.now() - cache.timestamp;
      
      // If cache is older than 7 days, consider it stale
      if (cacheAge > CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000) {
        return [];
      }
      
      return cache.messages || [];
    } catch (error) {
      console.error('Error getting cached messages:', error);
      return [];
    }
  }

  /**
   * Listen to messages in a conversation in real-time with improved reliability
   * @param {string} conversationId - Conversation ID
   * @param {Function} callback - Callback function for messages
   * @returns {Function} Unsubscribe function
   */
  listenToMessages(conversationId, callback) {
    if (!conversationId) {
      callback(new Error('Conversation ID is required'), null);
      return () => {};
    }
    
    const userId = this.getCurrentUser()?.uid;
    if (!userId) {
      callback(new Error('User not authenticated'), null);
      return () => {};
    }
    
    // Clean up existing listener if any
    this.removeListener('message', conversationId);
    
    // Initialize error handler
    this.initializeErrorHandler('message', conversationId, (error) => {
      callback(error, null);
    });
    
    // Start with cached messages if available
    this.getCachedMessages(conversationId).then(cachedMessages => {
      if (cachedMessages && cachedMessages.length > 0) {
        callback(null, cachedMessages.reverse()); // Reverse for chronological order
      }
    }).catch(() => {
      // Ignore cache errors
    });
    
    try {
      // Create new listener with error handling
      const unsubscribe = firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot(
          // Success handler
          snapshot => {
            try {
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
                batch.update(
                  firestore().collection('conversations').doc(conversationId),
                  { [`unreadCount.${userId}`]: 0 }
                );
                
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
              
              // Cache the messages
              this.cacheMessages(conversationId, messages.slice().reverse()); // Cache in desc order
              
              // Notify callback
              callback(null, messages);
            } catch (error) {
              this.handleListenerError('message', conversationId, error);
            }
          },
          // Error handler
          error => {
            this.handleListenerError('message', conversationId, error);
          }
        );
      
      // Store unsubscribe function
      this.messageListeners[conversationId] = unsubscribe;
      
      // Return unsubscribe function
      return () => {
        this.removeListener('message', conversationId);
      };
    } catch (error) {
      console.error('Error setting up message listener:', error);
      callback(error, null);
      return () => {};
    }
  }

  /**
   * Send a message with offline support
   * @param {string} conversationId - Conversation ID
   * @param {Object} message - Message data
   * @returns {Promise<Object>} Sent message data
   */
  async sendMessage(conversationId, message) {
    try {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }
      
      const userId = this.getCurrentUser()?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // Create message object with temporary ID for offline support
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tempTimestamp = new Date();
      
      const messageObj = {
        id: tempId,
        text: message.text || '',
        senderId: userId,
        timestamp: tempTimestamp,
        read: false,
        sending: true,
        failed: false,
        ...message
      };
      
      // Check if we're online
      const isOnline = await isDeviceOnline();
      
      if (!isOnline) {
        // If offline, queue the message
        await this.queueMessage(conversationId, messageObj);
        return messageObj;
      }
      
      // If online, send immediately
      return await this.performSendMessage(conversationId, messageObj);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Queue a message for later sending when offline
   * @param {string} conversationId - Conversation ID
   * @param {Object} message - Message data
   */
  async queueMessage(conversationId, message) {
    try {
      // Add message to pending queue
      this.pendingMessageQueue.push({
        conversationId,
        message,
        attempts: 0,
        timestamp: Date.now()
      });
      
      // Save to local storage for persistence
      await AsyncStorage.setItem('pending_messages', JSON.stringify(this.pendingMessageQueue));
      
      // Try to process the queue (no-op if already processing)
      this.processMessageQueue();
      
      // Manually update the local message cache to reflect the pending message
      const cachedMessages = await this.getCachedMessages(conversationId);
      cachedMessages.unshift(message); // Add at beginning (desc order)
      await this.cacheMessages(conversationId, cachedMessages);
    } catch (error) {
      console.error('Error queuing message:', error);
    }
  }

  /**
   * Process the pending message queue
   */
  async processMessageQueue() {
    // If already processing or queue is empty, return
    if (this.isProcessingQueue || this.pendingMessageQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      // Check if we're online
      const isOnline = await isDeviceOnline();
      
      if (!isOnline) {
        this.isProcessingQueue = false;
      
      // If there are still items in the queue, try again later
      if (this.pendingMessageQueue.length > 0) {
        setTimeout(() => this.processMessageQueue(), 30000); // Try again in 30 seconds
      }
    }
  }

  /**
   * Actual implementation of sending a message to Firestore
   * @param {string} conversationId - Conversation ID
   * @param {Object} message - Message data
   * @returns {Promise<Object>} Sent message data
   */
  async performSendMessage(conversationId, message) {
    try {
      const userId = this.getCurrentUser()?.uid;
      
      // Get conversation data
      const conversationDoc = await withRetry(() => 
        firestore()
          .collection('conversations')
          .doc(conversationId)
          .get()
      );
      
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
          withRetry(() => firestore().collection('users').doc(userId).get()),
          withRetry(() => firestore().collection('users').doc(recipientId).get())
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
        await withRetry(() => 
          firestore()
            .collection('conversations')
            .doc(conversationId)
            .update({
              [`participantsData.${userId}`]: userData,
              [`participantsData.${recipientId}`]: recipientData,
            })
        );
      }
      
      // Create message data
      const messageData = {
        text: message.text || '',
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
      
      // Use a batch for atomic operations
      const batch = firestore().batch();
      
      // Add message to conversation
      const messageRef = firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(); // Auto-generate ID
      
      batch.set(messageRef, messageData);
      
      // Update conversation with last message info
      batch.update(
        firestore().collection('conversations').doc(conversationId),
        {
          lastMessage: message.text || (message.image ? '[Image]' : ''),
          lastMessageTimestamp: firestore.FieldValue.serverTimestamp(),
          lastMessageSenderId: userId,
          [`unreadCount.${recipientId}`]: firestore.FieldValue.increment(1),
          [`deleted.${userId}`]: false,
          [`deleted.${recipientId}`]: false,
        }
      );
      
      // Commit batch
      await withRetry(() => batch.commit());
      
      // Create notification for recipient
      await withRetry(() => 
        firestore().collection('notifications').add({
          type: 'message',
          senderId: userId,
          senderName: userData.name,
          senderProfileImage: userData.profileImage,
          recipientId,
          conversationId,
          message: 'sent you a message',
          preview: (message.text || '[Image]').substring(0, 50) + 
                  ((message.text || '').length > 50 ? '...' : ''),
          timestamp: firestore.FieldValue.serverTimestamp(),
          read: false,
        })
      );
      
      return {
        id: messageRef.id,
        ...messageData,
        timestamp: new Date(),
        sending: false,
        failed: false,
      };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Update typing status for a conversation with error handling
   * @param {string} conversationId - Conversation ID
   * @param {boolean} isTyping - Whether user is typing
   * @returns {Promise<void>}
   */
  async updateTypingStatus(conversationId, isTyping) {
    try {
      const userId = this.getCurrentUser()?.uid;
      if (!userId || !conversationId) return;
      
      // Only update if online
      const isOnline = await isDeviceOnline();
      if (!isOnline) return;
      
      await withRetry(() => 
        firestore()
          .collection('conversations')
          .doc(conversationId)
          .update({
            [`typingStatus.${userId}`]: isTyping ? new Date().getTime() : null,
          })
      );
    } catch (error) {
      console.error('Error updating typing status:', error);
      // Fail silently - typing status is not critical
    }
  }

  /**
   * Listen to typing status changes with improved reliability
   * @param {string} conversationId - Conversation ID
   * @param {Function} callback - Callback function for typing status
   * @returns {Function} Unsubscribe function
   */
  listenToTypingStatus(conversationId, callback) {
    if (!conversationId) {
      callback(new Error('Conversation ID is required'), {});
      return () => {};
    }
    
    const userId = this.getCurrentUser()?.uid;
    if (!userId) {
      callback(new Error('User not authenticated'), {});
      return () => {};
    }
    
    // Clean up existing listener if any
    this.removeListener('typing', conversationId);
    
    // Initialize error handler
    this.initializeErrorHandler('typing', conversationId, (error) => {
      callback(error, {});
    });
    
    try {
      // Create new listener with error handling
      const unsubscribe = firestore()
        .collection('conversations')
        .doc(conversationId)
        .onSnapshot(
          // Success handler
          doc => {
            try {
              if (!doc.exists) {
                callback(null, {});
                return;
              }
              
              const data = doc.data();
              const typingStatus = data.typingStatus || {};
              
              // Filter out current user status and clean up old statuses
              const otherTypingStatus = {};
              const now = Date.now();
              
              Object.keys(typingStatus).forEach(key => {
                if (key !== userId && typingStatus[key]) {
                  // Only include typing status updates from last 30 seconds
                  if (now - typingStatus[key] < 30000) {
                    otherTypingStatus[key] = typingStatus[key];
                  }
                }
              });
              
              callback(null, otherTypingStatus);
            } catch (error) {
              this.handleListenerError('typing', conversationId, error);
            }
          },
          // Error handler
          error => {
            this.handleListenerError('typing', conversationId, error);
          }
        );
      
      // Store unsubscribe function
      this.typingStatusListeners[conversationId] = unsubscribe;
      
      // Return unsubscribe function
      return () => {
        this.removeListener('typing', conversationId);
      };
    } catch (error) {
      console.error('Error setting up typing status listener:', error);
      callback(error, {});
      return () => {};
    }
  }

  /**
   * Mark all messages in a conversation as read with error handling
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Result with count of marked messages
   */
  async markConversationAsRead(conversationId) {
    try {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }
      
      const userId = this.getCurrentUser()?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // Check if online
      const isOnline = await isDeviceOnline();
      if (!isOnline) {
        // Update local cache to mark messages as read
        const cachedMessages = await this.getCachedMessages(conversationId);
        if (cachedMessages && cachedMessages.length > 0) {
          const updatedMessages = cachedMessages.map(msg => {
            if (msg.recipientId === userId && !msg.read) {
              return { ...msg, read: true };
            }
            return msg;
          });
          
          await this.cacheMessages(conversationId, updatedMessages);
        }
        
        return { count: 0, offline: true };
      }
      
      // Get unread messages sent to this user
      const messagesSnapshot = await withRetry(() => 
        firestore()
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .where('recipientId', '==', userId)
          .where('read', '==', false)
          .get()
      );
      
      if (messagesSnapshot.empty) {
        return { count: 0 };
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
      
      await withRetry(() => batch.commit());
      
      return { count: messagesSnapshot.docs.length };
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      throw error;
    }
  }

  /**
   * Delete a message with error handling
   * @param {string} conversationId - Conversation ID
   * @param {string} messageId - Message ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteMessage(conversationId, messageId) {
    try {
      if (!conversationId || !messageId) {
        throw new Error('Conversation ID and Message ID are required');
      }
      
      const userId = this.getCurrentUser()?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // Get message to check ownership
      const messageDoc = await withRetry(() => 
        firestore()
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .doc(messageId)
          .get()
      );
      
      if (!messageDoc.exists) {
        throw new Error('Message not found');
      }
      
      const messageData = messageDoc.data();
      
      // Validate ownership - only sender can delete
      if (messageData.senderId !== userId) {
        throw new Error('You can only delete your own messages');
      }
      
      // Soft delete instead of hard delete
      await withRetry(() => 
        firestore()
          .collection('conversations')
          .doc(conversationId)
          .collection('messages')
          .doc(messageId)
          .update({
            deleted: true,
            text: 'This message was deleted',
            image: null,
            updatedAt: firestore.FieldValue.serverTimestamp()
          })
      );
      
      // If this was the last message, update conversation
      const conversationDoc = await withRetry(() => 
        firestore()
          .collection('conversations')
          .doc(conversationId)
          .get()
      );
      
      const conversationData = conversationDoc.data();
      if (conversationData.lastMessageSenderId === userId) {
        // Check if we need to update last message in conversation
        const lastMessagesSnapshot = await withRetry(() => 
          firestore()
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .where('deleted', '==', false)
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get()
        );
        
        if (!lastMessagesSnapshot.empty) {
          const lastMessage = lastMessagesSnapshot.docs[0].data();
          await withRetry(() => 
            firestore()
              .collection('conversations')
              .doc(conversationId)
              .update({
                lastMessage: lastMessage.text || (lastMessage.image ? '[Image]' : ''),
                lastMessageTimestamp: lastMessage.timestamp,
                lastMessageSenderId: lastMessage.senderId
              })
          );
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  /**
   * Delete entire conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Result
   */
  async deleteConversation(conversationId) {
    try {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }
      
      const userId = this.getCurrentUser()?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // We don't actually delete the conversation, just mark it as deleted for this user
      await withRetry(() => 
        firestore()
          .collection('conversations')
          .doc(conversationId)
          .update({
            [`deleted.${userId}`]: true,
          })
      );
      
      // Clear local cache for this conversation
      const cacheKey = `${MESSAGES_CACHE_PREFIX}${conversationId}`;
      await AsyncStorage.removeItem(cacheKey);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  /**
   * Get total unread messages count across all conversations
   * @returns {Promise<number>} Unread count
   */
  async getUnreadMessagesCount() {
    try {
      const userId = this.getCurrentUser()?.uid;
      if (!userId) {
        return 0;
      }
      
      // Check if online
      const isOnline = await isDeviceOnline();
      
      if (isOnline) {
        try {
          const snapshot = await withRetry(() => 
            firestore()
              .collection('conversations')
              .where('participants', 'array-contains', userId)
              .where(`deleted.${userId}`, '==', false)
              .get()
          );
          
          let totalUnread = 0;
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const unreadCount = data.unreadCount || {};
            totalUnread += unreadCount[userId] || 0;
          });
          
          return totalUnread;
        } catch (error) {
          console.error('Error getting unread messages count:', error);
          
          // Try to get from cache if online fetch fails
          const conversations = await this.getCachedConversations();
          if (conversations && conversations.length > 0) {
            let totalUnread = 0;
            conversations.forEach(conversation => {
              const unreadCount = conversation.unreadCount || {};
              totalUnread += unreadCount[userId] || 0;
            });
            return totalUnread;
          }
          
          return 0;
        }
      } else {
        // If offline, use cached conversations
        const conversations = await this.getCachedConversations();
        if (conversations && conversations.length > 0) {
          let totalUnread = 0;
          conversations.forEach(conversation => {
            const unreadCount = conversation.unreadCount || {};
            totalUnread += unreadCount[userId] || 0;
          });
          return totalUnread;
        }
        
        return 0;
      }
    } catch (error) {
      console.error('Error getting unread messages count:', error);
      return 0;
    }
  }

  /**
   * Load pending messages from storage
   * @returns {Promise<void>}
   */
  async loadPendingMessages() {
    try {
      const pendingString = await AsyncStorage.getItem('pending_messages');
      if (pendingString) {
        this.pendingMessageQueue = JSON.parse(pendingString);
        
        // Process queue if we have pending messages
        if (this.pendingMessageQueue.length > 0) {
          this.processMessageQueue();
        }
      }
    } catch (error) {
      console.error('Error loading pending messages:', error);
      this.pendingMessageQueue = [];
    }
  }

  /**
   * Clear expired cache entries
   * @returns {Promise<void>}
   */
  async clearExpiredCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const messageCacheKeys = keys.filter(key => key.startsWith(MESSAGES_CACHE_PREFIX));
      
      const now = Date.now();
      const maxAge = CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      
      for (const key of messageCacheKeys) {
        try {
          const cacheString = await AsyncStorage.getItem(key);
          if (cacheString) {
            const cache = JSON.parse(cacheString);
            const cacheAge = now - cache.timestamp;
            
            if (cacheAge > maxAge) {
              await AsyncStorage.removeItem(key);
            }
          }
        } catch (error) {
          // Skip this key on error
          console.error(`Error processing cache key ${key}:`, error);
        }
      }
    } catch (error) {
      console.error('Error clearing expired cache:', error);
    }
  }

  /**
   * Initialize the chat service with necessary startup operations
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Load pending messages
      await this.loadPendingMessages();
      
      // Clear expired cache
      await this.clearExpiredCache();
    } catch (error) {
      console.error('Error initializing chat service:', error);
    }
  }
}

// Create and export singleton instance
const chatService = new ChatService();

// Initialize on import
chatService.initialize().catch(error => {
  console.error('Failed to initialize chat service:', error);
});

export default chatService;;
        return;
      }
      
      // Process queue items
      const queue = [...this.pendingMessageQueue];
      this.pendingMessageQueue = [];
      
      for (const item of queue) {
        try {
          // Try to send the message
          await this.performSendMessage(item.conversationId, item.message);
        } catch (error) {
          console.error('Error processing queued message:', error);
          
          // If retryable and under max attempts, re-queue
          if (isRetriableError(error) && item.attempts < 3) {
            this.pendingMessageQueue.push({
              ...item,
              attempts: item.attempts + 1
            });
          }
        }
      }
      
      // Save updated queue
      await AsyncStorage.setItem('pending_messages', JSON.stringify(this.pendingMessageQueue));
    } catch (error) {
      console.error('Error processing message queue:', error);
    } finally {
      this.isProcessingQueue = false// src/services/ChatService.js
// Real-time chat functionality using Firestore with improved error handling and memory management

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Alert } from 'react-native';
import { withRetry, isRetriableError } from './RetryService';
import { isDeviceOnline } from './NetworkService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const MESSAGES_CACHE_PREFIX = 'chat_messages_';
const CONVERSATIONS_CACHE_KEY = 'chat_conversations';
const MESSAGE_BATCH_SIZE = 30;
const CACHE_RETENTION_DAYS = 7;

class ChatService {
  // Initialize the chat service
  constructor() {
    this.currentUser = null;
    this.messageListeners = {};
    this.conversationListeners = {};
    this.typingStatusListeners = {};
    this.pendingMessageQueue = [];
    this.isProcessingQueue = false;
    this.listenerErrorHandlers = {};
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
    
    // Clear other resources
    this.listenerErrorHandlers = {};
    this.pendingMessageQueue = [];
    this.isProcessingQueue = false;
  }
  
  /**
   * Initialize error handler for a specific listener
   * @param {string} listenerType - Type of listener ('message', 'conversation', 'typing')
   * @param {string} id - Identifier (e.g., conversationId)
   * @param {Function} callback - Callback to handle error
   */
  initializeErrorHandler(listenerType, id, callback) {
    const handlerId = `${listenerType}_${id}`;
    this.listenerErrorHandlers[handlerId] = callback;
  }
  
  /**
   * Handle listener error
   * @param {string} listenerType - Type of listener
   * @param {string} id - Identifier
   * @param {Error} error - The error that occurred
   */
  handleListenerError(listenerType, id, error) {
    console.error(`Error in ${listenerType} listener for ${id}:`, error);
    
    const handlerId = `${listenerType}_${id}`;
    const errorHandler = this.listenerErrorHandlers[handlerId];
    
    if (errorHandler && typeof errorHandler === 'function') {
      errorHandler(error);
    }
    
    // If it's a critical error, clean up the listener
    if (!isRetriableError(error)) {
      this.removeListener(listenerType, id);
    }
  }
  
  /**
   * Remove a specific listener
   * @param {string} listenerType - Type of listener
   * @param {string} id - Identifier
   */
  removeListener(listenerType, id) {
    const listenersMap = {
      'message': this.messageListeners,
      'conversation': this.conversationListeners,
      'typing': this.typingStatusListeners
    };
    
    const listenerMap = listenersMap[listenerType];
    if (listenerMap && listenerMap[id]) {
      if (typeof listenerMap[id] === 'function') {
        listenerMap[id]();
      }
      delete listenerMap[id];
    }
    
    const handlerId = `${listenerType}_${id}`;
    delete this.listenerErrorHandlers[handlerId];
  }

  /**
   * Get all user conversations with error handling and caching
   * @returns {Promise<Array>} Conversations list
   */
  async getConversations() {
    try {
      const userId = this.getCurrentUser()?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // Try to get cached conversations first
      const cachedData = await this.getCachedConversations();
      let conversations = [];
      
      // Check if we're online
      const isOnline = await isDeviceOnline();
      
      if (isOnline) {
        try {
          // Use withRetry for better reliability
          const snapshot = await withRetry(() => 
            firestore()
              .collection('conversations')
              .where('participants', 'array-contains', userId)
              .orderBy('lastMessageTimestamp', 'desc')
              .get()
          );
          
          conversations = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              lastMessageTimestamp: data.lastMessageTimestamp?.toDate() || null,
            };
          });
          
          // Cache the fresh data
          this.cacheConversations(conversations);
        } catch (error) {
          console.error('Error fetching conversations:', error);
          
          // If we have cached data, use it as fallback
          if (cachedData && cachedData.length > 0) {
            console.log('Using cached conversations data');
            conversations = cachedData;
          } else {
            throw error;
          }
        }
      } else if (cachedData && cachedData.length > 0) {
        // If offline and we have cached data, use it
        console.log('Offline mode: Using cached conversations data');
        conversations = cachedData;
      } else {
        throw new Error('Unable to load conversations while offline');
      }
      
      return conversations;
    } catch (error) {
      console.error('Error in getConversations:', error);
      throw error;
    }
  }

  /**
   * Cache conversations data
   * @param {Array} conversations - Conversations to cache
   */
  async cacheConversations(conversations) {
    try {
      if (!conversations || !Array.isArray(conversations)) return;
      
      const cacheData = {
        conversations,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching conversations:', error);
    }
  }

  /**
   * Get cached conversations
   * @returns {Promise<Array>} Cached conversations or empty array
   */
  async getCachedConversations() {
    try {
      const cacheString = await AsyncStorage.getItem(CONVERSATIONS_CACHE_KEY);
      if (!cacheString) return [];
      
      const cache = JSON.parse(cacheString);
      const cacheAge = Date.now() - cache.timestamp;
      
      // If cache is older than 7 days, consider it stale
      if (cacheAge > CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000) {
        return [];
      }
      
      return cache.conversations || [];
    } catch (error) {
      console.error('Error getting cached conversations:', error);
      return [];
    }
  }

  /**
   * Listen to user's conversations in real-time with improved error handling
   * @param {Function} callback - Callback function for conversations
   * @returns {Function} Unsubscribe function
   */
  listenToConversations(callback) {
    const userId = this.getCurrentUser()?.uid;
    if (!userId) {
      callback(new Error('User not authenticated'), null);
      return () => {};
    }
    
    // Clean up existing listener if any
    this.removeListener('conversation', 'main');
    
    // Initialize error handler
    this.initializeErrorHandler('conversation', 'main', (error) => {
      callback(error, null);
    });
    
    try {
      // Create new listener with error handling
      const unsubscribe = firestore()
        .collection('conversations')
        .where('participants', 'array-contains', userId)
        .orderBy('lastMessageTimestamp', 'desc')
        .onSnapshot(
          // Success handler
          snapshot => {
            try {
              const conversations = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  ...data,
                  lastMessageTimestamp: data.lastMessageTimestamp?.toDate() || null,
                };
              });
              
              // Cache conversations data
              this.cacheConversations(conversations);
              
              // Notify callback
              callback(null, conversations);
            } catch (error) {
              this.handleListenerError('conversation', 'main', error);
            }
          },
          // Error handler
          error => {
            this.handleListenerError('conversation', 'main', error);
          }
        );
      
      // Store unsubscribe function
      this.conversationListeners.main = unsubscribe;
      
      // Return unsubscribe function
      return () => {
        this.removeListener('conversation', 'main');
      };
    } catch (error) {
      console.error('Error setting up conversation listener:', error);
      callback(error, null);
      return () => {};
    }
  }

  /**
   * Get conversation with a specific user (creates one if it doesn't exist)
   * @param {string} otherUserId - ID of the other user
   * @returns {Promise<Object>} Conversation data
   */
  async getOrCreateConversation(otherUserId) {
    try {
      const userId = this.getCurrentUser()?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      if (!otherUserId) {
        throw new Error('Other user ID is required');
      }
      
      // Check if conversation already exists
      const snapshot = await withRetry(() => 
        firestore()
          .collection('conversations')
          .where('participants', 'array-contains', userId)
          .get()
      );
      
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
        withRetry(() => firestore().collection('users').doc(userId).get()),
        withRetry(() => firestore().collection('users').doc(otherUserId).get())
      ]);
      
      if (!otherUserDoc.exists) {
        throw new Error('User not found');
      }
      
      const currentUserData = currentUserDoc.data();
      const otherUserData = otherUserDoc.data();
      
      if (!currentUserData || !otherUserData) {
        throw new Error('Could not retrieve user data');
      }
      
      // Create new conversation
      const conversationRef = await withRetry(() => 
        firestore().collection('conversations').add({
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
          unreadCount: {
            [userId]: 0,
            [otherUserId]: 0,
          }
        })
      );
      
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
        unreadCount: {
          [userId]: 0,
          [otherUserId]: 0,
        }
      };
    } catch (error) {
      console.error('Error getting or creating conversation:', error);
      throw error;
    }
  }

  /**
   * Get messages for a conversation with caching
   * @param {string} conversationId - Conversation ID
   * @param {number} limit - Maximum messages to fetch
   * @returns {Promise<Array>} Messages list
   */
  async getMessages(conversationId, limit = MESSAGE_BATCH_SIZE) {
    try {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }
      
      // Get cached messages first
      const cachedMessages = await this.getCachedMessages(conversationId);
      let messages = [];
      
      // Check if we're online
      const isOnline = await isDeviceOnline();
      
      if (isOnline) {
        try {
          const snapshot = await withRetry(() => 
            firestore()
              .collection('conversations')
              .doc(conversationId)
              .collection('messages')
              .orderBy('timestamp', 'desc')
              .limit(limit)
              .get()
          );
          
          messages = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || null,
            };
          });
          
          // Cache the messages
          this.cacheMessages(conversationId, messages);
        } catch (error) {
          console.error('Error fetching messages:', error);
          
          // Use cached messages as fallback
          if (cachedMessages && cachedMessages.length > 0) {
            console.log('Using cached messages');
            messages = cachedMessages;
          } else {
            throw error;
          }
        }
      } else if (cachedMessages && cachedMessages.length > 0) {
        // If offline, use cached messages
        console.log('Offline mode: Using cached messages');
        messages = cachedMessages;
      } else {
        throw new Error('Unable to load messages while offline');
      }
      
      return messages.reverse(); // Reverse for chronological order
    } catch (error) {
      console.error('Error in getMessages:', error);
      throw error;
    }
  }

  /**
   * Cache messages
   * @param {string} conversationId - Conversation ID
   * @param {Array} messages - Messages to cache
   */
  async cacheMessages(conversationId, messages) {
    try {
      if (!conversationId || !messages || !Array.isArray(messages)) return;
      
      const cacheKey = `${MESSAGES_CACHE_PREFIX}${conversationId}`;
      const cacheData = {
        messages,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error caching messages:', error);
    }
  }

  /**
   * Get cached messages
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array>} Cached messages or empty array
   */
  async getCachedMessages(conversationId) {
    try {
      if (!conversationId) return [];
      
      const cacheKey = `${MESSAGES_CACHE_PREFIX}${conversationId}`;
      const cacheString = await AsyncStorage.getItem(cacheKey);
      
      if (!cacheString) return [];
      
      const cache = JSON.parse(cacheString);
      const cacheAge = Date.now() - cache.timestamp;
      
      // If cache is older than 7 days, consider it stale
      if (cacheAge > CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000) {
        return [];
      }
      
      return cache.messages || [];
    } catch (error) {
      console.error('Error getting cached messages:', error);
      return [];
    }
  }

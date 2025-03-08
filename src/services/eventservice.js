// src/services/EventService.js
// Firebase service methods for virtual events

import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { withRetry } from './RetryService';

/**
 * Event Services
 * 
 * Manages virtual event functionality in Firebase
 */
export const EventService = {
  /**
   * Create a new event
   * 
   * @param {Object} eventData - Event data
   * @returns {Promise<string>} Event ID
   */
  createEvent: async (eventData) => {
    try {
      const eventRef = await withRetry(() => 
        firestore().collection('events').add({
          ...eventData,
          attendeeCount: 1, // Host is first attendee
          attendees: [eventData.hostId], // Add host to attendees
          createdAt: firestore.FieldValue.serverTimestamp()
        })
      );
      
      return eventRef.id;
    } catch (error) {
      console.error('Error creating event:', error);
      throw new Error('Failed to create event. Please try again.');
    }
  },

  /**
   * Get event by ID
   * 
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Event data
   */
  getEventById: async (eventId) => {
    try {
      const eventDoc = await withRetry(() => 
        firestore().collection('events').doc(eventId).get()
      );
      
      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }
      
      return {
        id: eventDoc.id,
        ...eventDoc.data(),
        startDate: eventDoc.data().startDate?.toDate() || null,
        endDate: eventDoc.data().endDate?.toDate() || null,
        createdAt: eventDoc.data().createdAt?.toDate() || null
      };
    } catch (error) {
      console.error('Get event error:', error);
      throw new Error('Failed to load event. Please try again.');
    }
  },

  /**
   * Update an event
   * 
   * @param {string} eventId - Event ID
   * @param {Object} eventData - Event data to update
   * @returns {Promise<void>}
   */
  updateEvent: async (eventId, eventData) => {
    try {
      return await withRetry(() => 
        firestore().collection('events').doc(eventId).update(eventData)
      );
    } catch (error) {
      console.error('Update event error:', error);
      throw new Error('Failed to update event. Please try again.');
    }
  },

  /**
   * Delete an event
   * 
   * @param {string} eventId - Event ID
   * @returns {Promise<void>}
   */
  deleteEvent: async (eventId) => {
    try {
      // Get event to check if image needs deletion
      const eventDoc = await firestore().collection('events').doc(eventId).get();
      const eventData = eventDoc.data();
      
      // Use a batch for atomic operation
      const batch = firestore().batch();
      
      // Delete the event
      batch.delete(firestore().collection('events').doc(eventId));
      
      // Delete all RSVPs
      const rsvpsSnapshot = await firestore()
        .collection('eventRSVPs')
        .where('eventId', '==', eventId)
        .get();
        
      rsvpsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Commit the batch
      await withRetry(() => batch.commit());
      
      // Delete event image if it exists
      if (eventData && eventData.imageUrl) {
        try {
          const imageRef = storage().refFromURL(eventData.imageUrl);
          await imageRef.delete();
        } catch (imageError) {
          console.error('Error deleting event image:', imageError);
          // Continue even if image deletion fails
        }
      }
      
      return true;
    } catch (error) {
      console.error('Delete event error:', error);
      throw new Error('Failed to delete event. Please try again.');
    }
  },

  /**
   * Get upcoming events with filtering options
   * 
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} List of events
   */
  getEvents: async ({ 
    limit = 10, 
    lastDoc = null,
    condition = null,
    hostId = null,
    includePrivate = false,
    attendeeId = null
  }) => {
    try {
      let query = firestore()
        .collection('events')
        .where('startDate', '>=', new Date()) // Only upcoming events
        .orderBy('startDate', 'asc');
      
      // Apply condition filter if provided
      if (condition) {
        query = query.where('relatedConditions', 'array-contains', condition);
      }
      
      // Filter by host if provided
      if (hostId) {
        query = query.where('hostId', '==', hostId);
      }
      
      // Filter by attendee if provided
      if (attendeeId) {
        query = query.where('attendees', 'array-contains', attendeeId);
      }
      
      // Filter out private events if not specifically included
      if (!includePrivate) {
        query = query.where('isPrivate', '==', false);
      }
      
      // Apply pagination
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      query = query.limit(limit);
      
      // Execute query
      const eventsSnapshot = await withRetry(() => query.get());
      
      // Process results
      return {
        events: eventsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate() || null,
          endDate: doc.data().endDate?.toDate() || null,
          createdAt: doc.data().createdAt?.toDate() || null
        })),
        lastDoc: eventsSnapshot.docs.length > 0 
          ? eventsSnapshot.docs[eventsSnapshot.docs.length - 1] 
          : null,
        hasMore: eventsSnapshot.docs.length === limit
      };
    } catch (error) {
      console.error('Get events error:', error);
      throw new Error('Failed to load events. Please try again.');
    }
  },

  /**
   * Get past events
   * 
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} List of events
   */
  getPastEvents: async ({ 
    limit = 10, 
    lastDoc = null,
    condition = null,
    hostId = null
  }) => {
    try {
      let query = firestore()
        .collection('events')
        .where('endDate', '<', new Date()) // Only past events
        .orderBy('endDate', 'desc'); // Most recent first
      
      // Apply condition filter if provided
      if (condition) {
        query = query.where('relatedConditions', 'array-contains', condition);
      }
      
      // Filter by host if provided
      if (hostId) {
        query = query.where('hostId', '==', hostId);
      }
      
      // Apply pagination
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      query = query.limit(limit);
      
      // Execute query
      const eventsSnapshot = await withRetry(() => query.get());
      
      // Process results
      return {
        events: eventsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate() || null,
          endDate: doc.data().endDate?.toDate() || null,
          createdAt: doc.data().createdAt?.toDate() || null
        })),
        lastDoc: eventsSnapshot.docs.length > 0 
          ? eventsSnapshot.docs[eventsSnapshot.docs.length - 1] 
          : null,
        hasMore: eventsSnapshot.docs.length === limit
      };
    } catch (error) {
      console.error('Get past events error:', error);
      throw new Error('Failed to load past events. Please try again.');
    }
  },

  /**
   * RSVP to an event
   * 
   * @param {string} eventId - Event ID
   * @param {string} userId - User ID
   * @param {boolean} attending - Whether user is attending
   * @returns {Promise<boolean>} Success status
   */
  rsvpToEvent: async (eventId, userId, attending) => {
    try {
      const eventRef = firestore().collection('events').doc(eventId);
      
      // Use transaction to ensure data consistency
      await firestore().runTransaction(async (transaction) => {
        const eventDoc = await transaction.get(eventRef);
        
        if (!eventDoc.exists) {
          throw new Error('Event not found');
        }
        
        const eventData = eventDoc.data();
        const attendees = eventData.attendees || [];
        const isAttending = attendees.includes(userId);
        
        if (attending && !isAttending) {
          // Check if event is at capacity
          if (eventData.maxAttendees && eventData.attendeeCount >= eventData.maxAttendees) {
            throw new Error('This event is at maximum capacity');
          }
          
          // Add user to attendees
          transaction.update(eventRef, {
            attendees: firestore.FieldValue.arrayUnion(userId),
            attendeeCount: firestore.FieldValue.increment(1)
          });
          
          // Create RSVP record
          const rsvpRef = firestore().collection('eventRSVPs').doc(`${eventId}_${userId}`);
          transaction.set(rsvpRef, {
            eventId,
            userId,
            status: 'attending',
            timestamp: firestore.FieldValue.serverTimestamp()
          });
          
          // Create notification for event host
          if (userId !== eventData.hostId) {
            const userDoc = await transaction.get(
              firestore().collection('users').doc(userId)
            );
            
            const userData = userDoc.data();
            if (userData) {
              const notificationRef = firestore().collection('notifications').doc();
              transaction.set(notificationRef, {
                type: 'event_rsvp',
                senderId: userId,
                senderName: `${userData.firstName} ${userData.lastName}`,
                senderProfileImage: userData.profileImageURL,
                recipientId: eventData.hostId,
                eventId: eventId,
                message: 'is attending your event',
                timestamp: firestore.FieldValue.serverTimestamp(),
                read: false
              });
            }
          }
        } else if (!attending && isAttending) {
          // Remove user from attendees
          transaction.update(eventRef, {
            attendees: firestore.FieldValue.arrayRemove(userId),
            attendeeCount: firestore.FieldValue.increment(-1)
          });
          
          // Update RSVP record
          const rsvpRef = firestore().collection('eventRSVPs').doc(`${eventId}_${userId}`);
          transaction.set(rsvpRef, {
            eventId,
            userId,
            status: 'not_attending',
            timestamp: firestore.FieldValue.serverTimestamp()
          });
          
          // Create notification for event host if user is not the host
          if (userId !== eventData.hostId) {
            const userDoc = await transaction.get(
              firestore().collection('users').doc(userId)
            );
            
            const userData = userDoc.data();
            if (userData) {
              const notificationRef = firestore().collection('notifications').doc();
              transaction.set(notificationRef, {
                type: 'event_cancel',
                senderId: userId,
                senderName: `${userData.firstName} ${userData.lastName}`,
                senderProfileImage: userData.profileImageURL,
                recipientId: eventData.hostId,
                eventId: eventId,
                message: 'has canceled attendance to your event',
                timestamp: firestore.FieldValue.serverTimestamp(),
                read: false
              });
            }
          }
        }
      });
      
      return true;
    } catch (error) {
      console.error('RSVP to event error:', error);
      throw error;
    }
  },

  /**
   * Check if user is attending an event
   * 
   * @param {string} eventId - Event ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether user is attending
   */
  isAttending: async (eventId, userId) => {
    try {
      const eventDoc = await firestore().collection('events').doc(eventId).get();
      
      if (!eventDoc.exists) {
        return false;
      }
      
      const eventData = eventDoc.data();
      return eventData.attendees && eventData.attendees.includes(userId);
    } catch (error) {
      console.error('Check attendance error:', error);
      return false;
    }
  },

  /**
   * Get event attendees with user details
   * 
   * @param {string} eventId - Event ID
   * @returns {Promise<Array<Object>>} List of attendee details
   */
  getEventAttendees: async (eventId) => {
    try {
      const eventDoc = await firestore().collection('events').doc(eventId).get();
      
      if (!eventDoc.exists) {
        throw new Error('Event not found');
      }
      
      const eventData = eventDoc.data();
      const attendeeIds = eventData.attendees || [];
      
      if (attendeeIds.length === 0) {
        return [];
      }
      
      // Firebase can only query up to 10 IDs at a time with 'in' operator
      const attendeeBatches = [];
      for (let i = 0; i < attendeeIds.length; i += 10) {
        const batch = attendeeIds.slice(i, i + 10);
        const usersQuery = await firestore()
          .collection('users')
          .where(firestore.FieldPath.documentId(), 'in', batch)
          .get();
          
        attendeeBatches.push(...usersQuery.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })));
      }
      
      return attendeeBatches;
    } catch (error) {
      console.error('Get event attendees error:', error);
      throw new Error('Failed to load attendees. Please try again.');
    }
  },

  /**
   * Upload event image
   * 
   * @param {string} uri - Local image URI
   * @param {string} userId - User ID of uploader
   * @returns {Promise<string>} Download URL
   */
  uploadEventImage: async (uri, userId) => {
    try {
      const filename = uri.substring(uri.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop();
      const storagePath = `events/${userId}_${Date.now()}.${extension}`;
      const reference = storage().ref(storagePath);
      
      // Upload file
      await withRetry(() => reference.putFile(uri));
      
      // Get download URL
      const url = await withRetry(() => reference.getDownloadURL());
      
      return url;
    } catch (error) {
      console.error('Upload event image error:', error);
      throw new Error('Failed to upload event image. Please try again.');
    }
  },

  /**
   * Get user's hosted events
   * 
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} List of user's hosted events
   */
  getUserHostedEvents: async (userId, { limit = 10, lastDoc = null, includePast = false }) => {
    try {
      let query = firestore()
        .collection('events')
        .where('hostId', '==', userId);
      
      // Filter for upcoming or past events
      if (!includePast) {
        query = query.where('startDate', '>=', new Date())
                     .orderBy('startDate', 'asc');
      } else {
        query = query.orderBy('startDate', 'desc');
      }
      
      // Apply pagination
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      query = query.limit(limit);
      
      // Execute query
      const eventsSnapshot = await withRetry(() => query.get());
      
      // Process results
      return {
        events: eventsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate() || null,
          endDate: doc.data().endDate?.toDate() || null,
          createdAt: doc.data().createdAt?.toDate() || null
        })),
        lastDoc: eventsSnapshot.docs.length > 0 
          ? eventsSnapshot.docs[eventsSnapshot.docs.length - 1] 
          : null,
        hasMore: eventsSnapshot.docs.length === limit
      };
    } catch (error) {
      console.error('Get user hosted events error:', error);
      throw new Error('Failed to load your events. Please try again.');
    }
  },

  /**
   * Get user's attending events
   * 
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array<Object>>} List of events user is attending
   */
  getUserAttendingEvents: async (userId, { limit = 10, lastDoc = null, includePast = false }) => {
    try {
      let query = firestore()
        .collection('events')
        .where('attendees', 'array-contains', userId);
      
      // Filter for upcoming or past events
      if (!includePast) {
        query = query.where('startDate', '>=', new Date())
                     .orderBy('startDate', 'asc');
      } else {
        query = query.orderBy('startDate', 'desc');
      }
      
      // Apply pagination
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      query = query.limit(limit);
      
      // Execute query
      const eventsSnapshot = await withRetry(() => query.get());
      
      // Process results
      return {
        events: eventsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate() || null,
          endDate: doc.data().endDate?.toDate() || null,
          createdAt: doc.data().createdAt?.toDate() || null
        })),
        lastDoc: eventsSnapshot.docs.length > 0 
          ? eventsSnapshot.docs[eventsSnapshot.docs.length - 1] 
          : null,
        hasMore: eventsSnapshot.docs.length === limit
      };
    } catch (error) {
      console.error('Get user attending events error:', error);
      throw new Error('Failed to load events. Please try again.');
    }
  }
};

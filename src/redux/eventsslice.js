// src/redux/slices/eventsSlice.js
// Redux slice for virtual events management

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { EventService } from '../../services/EventService';

// Initial state
const initialState = {
  upcomingEvents: [],
  pastEvents: [],
  userHostedEvents: [],
  userAttendingEvents: [],
  currentEvent: null,
  attendees: [],
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  hasMore: {
    upcomingEvents: true,
    pastEvents: true,
    userHostedEvents: true,
    userAttendingEvents: true
  },
  lastDoc: {
    upcomingEvents: null,
    pastEvents: null,
    userHostedEvents: null,
    userAttendingEvents: null
  }
};

// Async thunks
export const fetchUpcomingEvents = createAsyncThunk(
  'events/fetchUpcoming',
  async ({ condition, limit = 10, blockedUsers = [] }, { getState, rejectWithValue }) => {
    try {
      const { lastDoc } = getState().events;
      
      const result = await EventService.getEvents({
        condition,
        limit,
        lastDoc: lastDoc.upcomingEvents
      });
      
      // Filter out events from blocked users
      const filteredEvents = result.events.filter(
        event => !blockedUsers.includes(event.hostId)
      );
      
      return {
        events: filteredEvents, 
        lastDoc: result.lastDoc,
        hasMore: result.hasMore
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchPastEvents = createAsyncThunk(
  'events/fetchPast',
  async ({ condition, limit = 10, blockedUsers = [] }, { getState, rejectWithValue }) => {
    try {
      const { lastDoc } = getState().events;
      
      const result = await EventService.getPastEvents({
        condition,
        limit,
        lastDoc: lastDoc.pastEvents
      });
      
      // Filter out events from blocked users
      const filteredEvents = result.events.filter(
        event => !blockedUsers.includes(event.hostId)
      );
      
      return {
        events: filteredEvents, 
        lastDoc: result.lastDoc,
        hasMore: result.hasMore
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchUserHostedEvents = createAsyncThunk(
  'events/fetchUserHosted',
  async ({ userId, limit = 10, includePast = false }, { getState, rejectWithValue }) => {
    try {
      const { lastDoc } = getState().events;
      
      const result = await EventService.getUserHostedEvents(userId, {
        limit,
        lastDoc: lastDoc.userHostedEvents,
        includePast
      });
      
      return {
        events: result.events, 
        lastDoc: result.lastDoc,
        hasMore: result.hasMore
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchUserAttendingEvents = createAsyncThunk(
  'events/fetchUserAttending',
  async ({ userId, limit = 10, includePast = false }, { getState, rejectWithValue }) => {
    try {
      const { lastDoc } = getState().events;
      
      const result = await EventService.getUserAttendingEvents(userId, {
        limit,
        lastDoc: lastDoc.userAttendingEvents,
        includePast
      });
      
      return {
        events: result.events, 
        lastDoc: result.lastDoc,
        hasMore: result.hasMore
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchEventById = createAsyncThunk(
  'events/fetchById',
  async (eventId, { rejectWithValue }) => {
    try {
      const event = await EventService.getEventById(eventId);
      return event;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createEvent = createAsyncThunk(
  'events/create',
  async (eventData, { rejectWithValue }) => {
    try {
      // Upload image if included
      let imageUrl = null;
      if (eventData.imageUri) {
        imageUrl = await EventService.uploadEventImage(
          eventData.imageUri,
          eventData.hostId
        );
      }
      
      // Prepare event data with image URL
      const eventWithImage = {
        ...eventData,
        imageUrl,
        // Remove the local image URI
        imageUri: undefined
      };
      
      const eventId = await EventService.createEvent(eventWithImage);
      return { id: eventId, ...eventWithImage };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateEvent = createAsyncThunk(
  'events/update',
  async ({ eventId, eventData }, { rejectWithValue }) => {
    try {
      // Upload new image if included
      if (eventData.imageUri) {
        const imageUrl = await EventService.uploadEventImage(
          eventData.imageUri,
          eventData.hostId
        );
        eventData.imageUrl = imageUrl;
      }
      
      // Remove the local image URI before sending to Firestore
      const { imageUri, ...dataToUpdate } = eventData;
      
      await EventService.updateEvent(eventId, dataToUpdate);
      return { id: eventId, ...dataToUpdate };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteEvent = createAsyncThunk(
  'events/delete',
  async (eventId, { rejectWithValue }) => {
    try {
      await EventService.deleteEvent(eventId);
      return eventId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const rsvpToEvent = createAsyncThunk(
  'events/rsvp',
  async ({ eventId, userId, attending }, { rejectWithValue }) => {
    try {
      await EventService.rsvpToEvent(eventId, userId, attending);
      return { eventId, userId, attending };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchEventAttendees = createAsyncThunk(
  'events/fetchAttendees',
  async (eventId, { rejectWithValue }) => {
    try {
      const attendees = await EventService.getEventAttendees(eventId);
      return { eventId, attendees };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Events slice
const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    resetEvents: (state) => {
      state.upcomingEvents = [];
      state.pastEvents = [];
      state.userHostedEvents = [];
      state.userAttendingEvents = [];
      state.currentEvent = null;
      state.attendees = [];
      state.status = 'idle';
      state.error = null;
      state.hasMore = {
        upcomingEvents: true,
        pastEvents: true,
        userHostedEvents: true,
        userAttendingEvents: true
      };
      state.lastDoc = {
        upcomingEvents: null,
        pastEvents: null,
        userHostedEvents: null,
        userAttendingEvents: null
      };
    },
    clearEventError: (state) => {
      state.error = null;
      state.status = 'idle';
    },
    resetCurrentEvent: (state) => {
      state.currentEvent = null;
    },
    resetAttendees: (state) => {
      state.attendees = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch upcoming events
      .addCase(fetchUpcomingEvents.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchUpcomingEvents.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (action.meta.arg.reset) {
          state.upcomingEvents = action.payload.events;
        } else {
          state.upcomingEvents = [...state.upcomingEvents, ...action.payload.events];
        }
        state.lastDoc.upcomingEvents = action.payload.lastDoc;
        state.hasMore.upcomingEvents = action.payload.hasMore;
      })
      .addCase(fetchUpcomingEvents.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // Fetch past events
      .addCase(fetchPastEvents.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchPastEvents.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (action.meta.arg.reset) {
          state.pastEvents = action.payload.events;
        } else {
          state.pastEvents = [...state.pastEvents, ...action.payload.events];
        }
        state.lastDoc.pastEvents = action.payload.lastDoc;
        state.hasMore.pastEvents = action.payload.hasMore;
      })
      .addCase(fetchPastEvents.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // Fetch user hosted events
      .addCase(fetchUserHostedEvents.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchUserHostedEvents.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (action.meta.arg.reset) {
          state.userHostedEvents = action.payload.events;
        } else {
          state.userHostedEvents = [...state.userHostedEvents, ...action.payload.events];
        }
        state.lastDoc.userHostedEvents = action.payload.lastDoc;
        state.hasMore.userHostedEvents = action.payload.hasMore;
      })
      .addCase(fetchUserHostedEvents.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // Fetch user attending events
      .addCase(fetchUserAttendingEvents.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchUserAttendingEvents.fulfilled, (state, action) => {
        state.status = 'succeeded';
        if (action.meta.arg.reset) {
          state.userAttendingEvents = action.payload.events;
        } else {
          state.userAttendingEvents = [...state.userAttendingEvents, ...action.payload.events];
        }
        state.lastDoc.userAttendingEvents = action.payload.lastDoc;
        state.hasMore.userAttendingEvents = action.payload.hasMore;
      })
      .addCase(fetchUserAttendingEvents.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // Fetch event by ID
      .addCase(fetchEventById.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchEventById.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.currentEvent = action.payload;
      })
      .addCase(fetchEventById.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // Create event
      .addCase(createEvent.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(createEvent.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.currentEvent = action.payload;
        // Add to user hosted events if this list exists
        if (state.userHostedEvents.length > 0) {
          state.userHostedEvents.unshift(action.payload);
        }
        // Add to upcoming events if this list exists
        if (state.upcomingEvents.length > 0) {
          state.upcomingEvents.push(action.payload);
          // Sort by start date (ascending)
          state.upcomingEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        }
      })
      .addCase(createEvent.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // Update event
      .addCase(updateEvent.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updateEvent.fulfilled, (state, action) => {
        state.status = 'succeeded';
        
        // Update current event if it's the same
        if (state.currentEvent && state.currentEvent.id === action.payload.id) {
          state.currentEvent = { ...state.currentEvent, ...action.payload };
        }
        
        // Update in upcoming events list
        state.upcomingEvents = state.upcomingEvents.map(event => 
          event.id === action.payload.id ? { ...event, ...action.payload } : event
        );
        
        // Update in past events list
        state.pastEvents = state.pastEvents.map(event => 
          event.id === action.payload.id ? { ...event, ...action.payload } : event
        );
        
        // Update in user hosted events list
        state.userHostedEvents = state.userHostedEvents.map(event => 
          event.id === action.payload.id ? { ...event, ...action.payload } : event
        );
        
        // Update in user attending events list
        state.userAttendingEvents = state.userAttendingEvents.map(event => 
          event.id === action.payload.id ? { ...event, ...action.payload } : event
        );
      })
      .addCase(updateEvent.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // Delete event
      .addCase(deleteEvent.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(deleteEvent.fulfilled, (state, action) => {
        state.status = 'succeeded';
        
        // Remove from all lists
        state.upcomingEvents = state.upcomingEvents.filter(event => event.id !== action.payload);
        state.pastEvents = state.pastEvents.filter(event => event.id !== action.payload);
        state.userHostedEvents = state.userHostedEvents.filter(event => event.id !== action.payload);
        state.userAttendingEvents = state.userAttendingEvents.filter(event => event.id !== action.payload);
        
        // Clear current event if it's the deleted one
        if (state.currentEvent && state.currentEvent.id === action.payload) {
          state.currentEvent = null;
        }
      })
      .addCase(deleteEvent.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // RSVP to event
      .addCase(rsvpToEvent.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(rsvpToEvent.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const { eventId, userId, attending } = action.payload;
        
        // Helper function to update attendee list in an event
        const updateEventAttendees = (event) => {
          if (event.id !== eventId) return event;
          
          let attendees = [...(event.attendees || [])];
          let attendeeCount = event.attendeeCount || 0;
          
          if (attending && !attendees.includes(userId)) {
            attendees.push(userId);
            attendeeCount += 1;
          } else if (!attending && attendees.includes(userId)) {
            attendees = attendees.filter(id => id !== userId);
            attendeeCount = Math.max(0, attendeeCount - 1);
          }
          
          return {
            ...event,
            attendees,
            attendeeCount
          };
        };
        
        // Update in all event lists
        state.upcomingEvents = state.upcomingEvents.map(updateEventAttendees);
        state.pastEvents = state.pastEvents.map(updateEventAttendees);
        state.userHostedEvents = state.userHostedEvents.map(updateEventAttendees);
        
        // Special handling for user attending events
        if (attending) {
          // If user is attending and event is not in attending list, add it
          const isInAttendingList = state.userAttendingEvents.some(e => e.id === eventId);
          if (!isInAttendingList) {
            // Find the event from one of the other lists
            const event = 
              state.upcomingEvents.find(e => e.id === eventId) ||
              state.pastEvents.find(e => e.id === eventId) ||
              state.userHostedEvents.find(e => e.id === eventId);
              
            if (event) {
              const updatedEvent = updateEventAttendees(event);
              state.userAttendingEvents.push(updatedEvent);
              // Sort by start date (ascending)
              state.userAttendingEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            }
          } else {
            state.userAttendingEvents = state.userAttendingEvents.map(updateEventAttendees);
          }
        } else {
          // If user is not attending, remove from attending list
          state.userAttendingEvents = state.userAttendingEvents
            .filter(event => event.id !== eventId || event.hostId === userId);
        }
        
        // Update current event if it's the same
        if (state.currentEvent && state.currentEvent.id === eventId) {
          state.currentEvent = updateEventAttendees(state.currentEvent);
        }
      })
      .addCase(rsvpToEvent.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      
      // Fetch event attendees
      .addCase(fetchEventAttendees.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchEventAttendees.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.attendees = action.payload.attendees;
      })
      .addCase(fetchEventAttendees.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { resetEvents, clearEventError, resetCurrentEvent, resetAttendees } = eventsSlice.actions;

export default eventsSlice.reducer;
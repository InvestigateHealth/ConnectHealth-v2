// src/screens/EventDetailScreen.js
// Detailed view of a virtual event

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
  Platform
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useSelector, useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { useTheme } from '../theme/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { 
  fetchEventById, 
  fetchEventAttendees,
  rsvpToEvent,
  deleteEvent
} from '../redux/slices/eventsSlice';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { Badge } from '../components/Badge';
import moment from 'moment';

const EventDetailScreen = ({ route, navigation }) => {
  const { eventId } = route.params;
  const dispatch = useDispatch();
  const { theme } = useTheme();
  const { user, userData } = useUser();
  
  const { currentEvent, attendees, status, error } = useSelector(state => state.events);
  const [isAttending, setIsAttending] = useState(false);
  const [isUserHost, setIsUserHost] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [loadingRSVP, setLoadingRSVP] = useState(false);
  
  // Fetch event data when component mounts
  useEffect(() => {
    dispatch(fetchEventById(eventId));
  }, [eventId, dispatch]);
  
  // Fetch attendees when event is loaded
  useEffect(() => {
    if (currentEvent) {
      dispatch(fetchEventAttendees(eventId));
      
      // Check if user is attending
      if (user && currentEvent.attendees) {
        setIsAttending(currentEvent.attendees.includes(user.uid));
      }
      
      // Check if user is the host
      if (user && currentEvent.hostId) {
        setIsUserHost(currentEvent.hostId === user.uid);
      }
    }
  }, [currentEvent, user, dispatch]);
  
  // Handle RSVP
  const handleRSVP = async () => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'You need to be signed in to RSVP for events.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Check attendance limit
    if (!isAttending && currentEvent.maxAttendees && currentEvent.attendeeCount >= currentEvent.maxAttendees) {
      Alert.alert(
        'Event Full',
        'This event has reached its maximum number of attendees.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    try {
      setLoadingRSVP(true);
      
      await dispatch(rsvpToEvent({
        eventId,
        userId: user.uid,
        attending: !isAttending
      })).unwrap();
      
      setIsAttending(!isAttending);
      
      // Show confirmation
      if (!isAttending) {
        Alert.alert(
          'RSVP Confirmed',
          'You\'re now registered for this event. The event details will be available in your My Events tab.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', error.toString());
    } finally {
      setLoadingRSVP(false);
    }
  };
  
  // Handle event edit
  const handleEditEvent = () => {
    navigation.navigate('EditEvent', { eventId });
  };
  
  // Handle event delete
  const handleDeleteEvent = () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deleteEvent(eventId)).unwrap();
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', error.toString());
            }
          }
        }
      ]
    );
  };
  
  // Handle share event
  const handleShareEvent = async () => {
    try {
      const message = `Join me at ${currentEvent.title} on ${format(new Date(currentEvent.startDate), 'MMMM d, yyyy')}!`;
      const url = `healthconnect://event/${eventId}`;
      
      await Share.share({
        message: `${message}\n\n${currentEvent.description}\n\n${url}`,
        title: currentEvent.title
      });
    } catch (error) {
      console.error('Error sharing event:', error);
    }
  };
  
  // Handle navigation to host profile
  const handleViewHostProfile = () => {
    if (currentEvent.hostId) {
      navigation.navigate('UserProfile', { 
        userId: currentEvent.hostId,
        title: currentEvent.hostName
      });
    }
  };
  
  // Handle navigating to attendees list
  const handleViewAttendees = () => {
    navigation.navigate('EventAttendees', { 
      eventId,
      eventTitle: currentEvent.title
    });
  };
  
  // Handle joining virtual meeting
  const handleJoinMeeting = () => {
    if (currentEvent.meetingUrl) {
      Linking.openURL(currentEvent.meetingUrl);
    }
  };
  
  // Add to calendar
  const handleAddToCalendar = async () => {
    try {
      // Implementation would depend on a calendar library
      // Example using react-native-calendar-events:
      Alert.alert(
        'Calendar Integration',
        'This feature will be implemented with a calendar library.'
      );
    } catch (error) {
      console.error('Error adding to calendar:', error);
    }
  };
  
  // Format date and time
  const formatEventDateTime = () => {
    if (!currentEvent?.startDate || !currentEvent?.endDate) return '';
    
    const startDate = new Date(currentEvent.startDate);
    const endDate = new Date(currentEvent.endDate);
    
    const isSameDay = startDate.toDateString() === endDate.toDateString();
    
    if (isSameDay) {
      return `${format(startDate, 'EEEE, MMMM d, yyyy')}\n${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')} ${currentEvent.timezone || ''}`;
    } else {
      return `From: ${format(startDate, 'EEEE, MMMM d, yyyy, h:mm a')}\nTo: ${format(endDate, 'EEEE, MMMM d, yyyy, h:mm a')} ${currentEvent.timezone || ''}`;
    }
  };
  
  // Render loading state
  if (status === 'loading' && !currentEvent) {
    return <LoadingIndicator />;
  }
  
  // Render error state
  if (status === 'failed' || !currentEvent) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background.default }]}>
        <Icon name="alert-circle-outline" size={60} color={theme.colors.error.main} />
        <Text style={[styles.errorText, { color: theme.colors.text.primary }]}>
          {error || 'Failed to load event details'}
        </Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: theme.colors.primary.main }]}
          onPress={() => dispatch(fetchEventById(eventId))}
        >
          <Text style={{ color: theme.colors.common.white, fontWeight: 'bold' }}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Event time status (upcoming, in progress, past)
  const getEventStatus = () => {
    const now = new Date();
    const startDate = new Date(currentEvent.startDate);
    const endDate = new Date(currentEvent.endDate);
    
    if (now < startDate) {
      return {
        label: 'Upcoming',
        color: theme.colors.primary.main,
        backgroundColor: theme.colors.primary.lightest
      };
    } else if (now >= startDate && now <= endDate) {
      return {
        label: 'In Progress',
        color: theme.colors.success.main,
        backgroundColor: theme.colors.success.lightest
      };
    } else {
      return {
        label: 'Past',
        color: theme.colors.text.secondary,
        backgroundColor: theme.colors.gray[200]
      };
    }
  };
  
  // Get relative time to event
  const getRelativeTime = () => {
    const now = new Date();
    const startDate = new Date(currentEvent.startDate);
    
    if (now < startDate) {
      return `Starts ${moment(startDate).fromNow()}`;
    } else {
      return null;
    }
  };
  
  const eventStatus = getEventStatus();
  const relativeTime = getRelativeTime();
  const isUpcoming = new Date() < new Date(currentEvent.startDate);
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.default }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Event Image */}
        <View style={styles.imageContainer}>
          {currentEvent.imageUrl ? (
            <FastImage
              source={{ uri: currentEvent.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeholderImage, { backgroundColor: theme.colors.primary.light }]}>
              <Icon name="calendar" size={80} color={theme.colors.primary.contrastText} />
            </View>
          )}
          
          {/* Event Status Badge */}
          <View 
            style={[
              styles.statusBadge, 
              { backgroundColor: eventStatus.backgroundColor }
            ]}
          >
            <Text style={[styles.statusText, { color: eventStatus.color }]}>
              {eventStatus.label}
            </Text>
          </View>
        </View>
        
        {/* Host Info */}
        <TouchableOpacity 
          style={[styles.hostRow, { backgroundColor: theme.colors.background.paper }]}
          onPress={handleViewHostProfile}
        >
          <Text style={[styles.hostedByText, { color: theme.colors.text.secondary }]}>
            Hosted by:
          </Text>
          <Text style={[styles.hostName, { color: theme.colors.text.primary }]}>
            {currentEvent.hostName}
          </Text>
          <Icon name="chevron-forward" size={20} color={theme.colors.text.secondary} />
        </TouchableOpacity>
        
        {/* Event Title and Details */}
        <View style={[styles.detailsContainer, { backgroundColor: theme.colors.background.paper }]}>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            {currentEvent.title}
          </Text>
          
          {relativeTime && (
            <Text style={[styles.relativeTime, { color: theme.colors.primary.main }]}>
              {relativeTime}
            </Text>
          )}
          
          <View style={styles.infoRow}>
            <Icon name="time-outline" size={20} color={theme.colors.text.secondary} />
            <Text style={[styles.infoText, { color: theme.colors.text.primary }]}>
              {formatEventDateTime()}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon name="people-outline" size={20} color={theme.colors.text.secondary} />
            <Text style={[styles.infoText, { color: theme.colors.text.primary }]}>
              {currentEvent.attendeeCount || 1} {currentEvent.attendeeCount === 1 ? 'attendee' : 'attendees'}
              {currentEvent.maxAttendees ? ` (max: ${currentEvent.maxAttendees})` : ''}
            </Text>
            <TouchableOpacity 
              style={styles.viewAttendeesButton} 
              onPress={handleViewAttendees}
            >
              <Text style={[styles.viewAttendeesText, { color: theme.colors.primary.main }]}>
                View
              </Text>
            </TouchableOpacity>
          </View>
          
          {currentEvent.isOnline && (
            <View style={styles.infoRow}>
              <Icon name="videocam-outline" size={20} color={theme.colors.text.secondary} />
              <Text style={[styles.infoText, { color: theme.colors.text.primary }]}>
                Virtual Event ({currentEvent.meetingPlatform || 'Online'})
              </Text>
            </View>
          )}
          
          {/* Conditions Tags */}
          {currentEvent.relatedConditions && currentEvent.relatedConditions.length > 0 && (
            <View style={styles.conditionsContainer}>
              <Text style={[styles.conditionsLabel, { color: theme.colors.text.secondary }]}>
                Related to:
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.conditionList}
              >
                {currentEvent.relatedConditions.map((condition, index) => (
                  <Badge 
                    key={index}
                    label={condition}
                    variant="primary"
                    size="small"
                    style={styles.conditionBadge}
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </View>
        
        {/* Event Description */}
        <View style={[styles.sectionContainer, { backgroundColor: theme.colors.background.paper }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Description
          </Text>
          
          <Text 
            style={[styles.description, { color: theme.colors.text.primary }]}
            numberOfLines={showFullDescription ? undefined : 5}
          >
            {currentEvent.description}
          </Text>
          
          {currentEvent.description && currentEvent.description.length > 200 && (
            <TouchableOpacity 
              style={styles.showMoreButton}
              onPress={() => setShowFullDescription(!showFullDescription)}
            >
              <Text style={[styles.showMoreText, { color: theme.colors.primary.main }]}>
                {showFullDescription ? 'Show Less' : 'Show More'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Meeting Information (if online and user is attending or host) */}
        {currentEvent.isOnline && (isAttending || isUserHost) && isUpcoming && (
          <View style={[styles.sectionContainer, { backgroundColor: theme.colors.background.paper }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
              Meeting Details
            </Text>
            
            {currentEvent.meetingUrl && (
              <View style={styles.meetingDetail}>
                <Text style={[styles.meetingLabel, { color: theme.colors.text.secondary }]}>
                  Meeting Link:
                </Text>
                <TouchableOpacity onPress={handleJoinMeeting}>
                  <Text style={[styles.meetingLink, { color: theme.colors.primary.main }]}>
                    {currentEvent.meetingUrl}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            
            {currentEvent.meetingPassword && (
              <View style={styles.meetingDetail}>
                <Text style={[styles.meetingLabel, { color: theme.colors.text.secondary }]}>
                  Password:
                </Text>
                <Text style={[styles.meetingText, { color: theme.colors.text.primary }]}>
                  {currentEvent.meetingPassword}
                </Text>
              </View>
            )}
            
            {isUpcoming && currentEvent.meetingUrl && (
              <TouchableOpacity 
                style={[
                  styles.joinButton, 
                  { backgroundColor: theme.colors.success.main }
                ]}
                onPress={handleJoinMeeting}
              >
                <Icon name="videocam" size={18} color={theme.colors.common.white} />
                <Text style={styles.joinButtonText}>
                  Join Meeting
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
      
      {/* Action Buttons */}
      <View style={[styles.actionContainer, { backgroundColor: theme.colors.background.paper }]}>
        {isUserHost ? (
          <View style={styles.hostActions}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.colors.primary.main }]}
              onPress={handleEditEvent}
            >
              <Icon name="create-outline" size={20} color={theme.colors.common.white} />
              <Text style={styles.actionButtonText}>Edit Event</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.colors.error.main }]}
              onPress={handleDeleteEvent}
            >
              <Icon name="trash-outline" size={20} color={theme.colors.common.white} />
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ) : isUpcoming ? (
          <View style={styles.attendeeActions}>
            <TouchableOpacity 
              style={[
                styles.rsvpButton, 
                { 
                  backgroundColor: isAttending 
                    ? theme.colors.background.default
                    : theme.colors.primary.main,
                  borderColor: isAttending 
                    ? theme.colors.error.main
                    : theme.colors.primary.main,
                }
              ]}
              onPress={handleRSVP}
              disabled={loadingRSVP}
            >
              {loadingRSVP ? (
                <ActivityIndicator size="small" color={theme.colors.primary.main} />
              ) : (
                <>
                  <Icon 
                    name={isAttending ? "close-circle-outline" : "checkmark-circle-outline"} 
                    size={20} 
                    color={isAttending ? theme.colors.error.main : theme.colors.common.white} 
                  />
                  <Text 
                    style={[
                      styles.rsvpButtonText,
                      { color: isAttending ? theme.colors.error.main : theme.colors.common.white }
                    ]}
                  >
                    {isAttending ? 'Cancel RSVP' : 'RSVP'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.calendarButton, { borderColor: theme.colors.primary.main }]}
              onPress={handleAddToCalendar}
            >
              <Icon name="calendar-outline" size={20} color={theme.colors.primary.main} />
              <Text style={[styles.calendarButtonText, { color: theme.colors.primary.main }]}>
                Add to Calendar
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.pastEventText, { color: theme.colors.text.secondary }]}>
            This event has already ended
          </Text>
        )}
        
        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: theme.colors.background.default }]}
          onPress={handleShareEvent}
        >
          <Icon name="share-social-outline" size={22} color={theme.colors.primary.main} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Space for action buttons
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  hostedByText: {
    fontSize: 14,
  },
  hostName: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 5,
  },
  detailsContainer: {
    padding: 15,
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  relativeTime: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  infoText: {
    fontSize: 15,
    marginLeft: 10,
    flex: 1,
  },
  viewAttendeesButton: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  viewAttendeesText: {
    fontSize: 14,
    fontWeight: '500',
  },
  conditionsContainer: {
    marginTop: 15,
  },
  conditionsLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  conditionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  conditionBadge: {
    marginRight: 5,
    marginBottom: 5,
  },
  sectionContainer: {
    padding: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  showMoreButton: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '500',
  },
  meetingDetail: {
    marginBottom: 10,
  },
  meetingLabel: {
    fontSize: 14,
    marginBottom: 3,
  },
  meetingText: {
    fontSize: 15,
  },
  meetingLink: {
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginTop: 10,
  },
  joinButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostActions: {
    flex: 1,
    flexDirection: 'row',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginRight: 10,
    flex: 1,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  attendeeActions: {
    flex: 1,
    flexDirection: 'row',
  },
  rsvpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    borderWidth: 1,
    flex: 1.5,
    marginRight: 10,
  },
  rsvpButtonText: {
    fontWeight: 'bold',
    marginLeft: 5,
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    borderWidth: 1,
    flex: 2,
  },
  calendarButtonText: {
    fontWeight: 'bold',
    marginLeft: 5,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  pastEventText: {
    flex: 1,
    fontSize: 15,
    fontStyle: 'italic',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
});

export default EventDetailScreen;
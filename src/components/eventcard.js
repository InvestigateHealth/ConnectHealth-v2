// src/components/EventCard.js
// Card component for displaying event information

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { useTheme } from '../theme/ThemeContext';
import { Badge } from './Badge';

const EventCard = ({ event, onPress }) => {
  const { theme } = useTheme();
  
  // Format date
  const formatEventDate = () => {
    if (!event?.startDate) return '';
    
    const startDate = new Date(event.startDate);
    return format(startDate, 'EEE, MMM d, yyyy • h:mm a');
  };
  
  // Get event status (upcoming, in progress, past)
  const getEventStatus = () => {
    const now = new Date();
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    
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
  
  const eventStatus = getEventStatus();
  
  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.card, borderColor: theme.colors.divider }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {event.imageUrl ? (
          <FastImage
            source={{ uri: event.imageUrl }}
            style={styles.image}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: theme.colors.primary.light }]}>
            <Icon name="calendar" size={40} color={theme.colors.primary.contrastText} />
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
      
      <View style={styles.contentContainer}>
        <Text 
          style={[styles.title, { color: theme.colors.text.primary }]}
          numberOfLines={2}
        >
          {event.title}
        </Text>
        
        <View style={styles.infoRow}>
          <Icon name="time-outline" size={16} color={theme.colors.text.secondary} />
          <Text style={[styles.infoText, { color: theme.colors.text.secondary }]}>
            {formatEventDate()}
          </Text>
        </View>
        
        <View style={styles.infoRow}>
          <Icon name="person-outline" size={16} color={theme.colors.text.secondary} />
          <Text style={[styles.infoText, { color: theme.colors.text.secondary }]}>
            {event.hostName}
          </Text>
        </View>
        
        {event.isOnline && (
          <View style={styles.infoRow}>
            <Icon name="videocam-outline" size={16} color={theme.colors.text.secondary} />
            <Text style={[styles.infoText, { color: theme.colors.text.secondary }]}>
              Virtual Event
            </Text>
          </View>
        )}
        
        {/* Conditions Tags */}
        {event.relatedConditions && event.relatedConditions.length > 0 && (
          <View style={styles.conditionsContainer}>
            {event.relatedConditions.slice(0, 2).map((condition, index) => (
              <Badge 
                key={index}
                label={condition}
                variant="primary"
                size="small"
                style={styles.conditionBadge}
              />
            ))}
            
            {event.relatedConditions.length > 2 && (
              <Badge 
                label={`+${event.relatedConditions.length - 2} more`}
                variant="secondary"
                size="small"
                style={styles.conditionBadge}
              />
            )}
          </View>
        )}
        
        {/* Attendee count */}
        <View style={styles.attendeeRow}>
          <Icon name="people-outline" size={16} color={theme.colors.text.secondary} />
          <Text style={[styles.attendeeText, { color: theme.colors.text.secondary }]}>
            {event.attendeeCount || 1} {event.attendeeCount === 1 ? 'attendee' : 'attendees'}
          </Text>
          
          {event.maxAttendees && (
            <View style={[
              styles.capacityContainer, 
              { backgroundColor: theme.colors.background.default }
            ]}>
              <Text style={[styles.capacityText, { color: theme.colors.text.secondary }]}>
                {event.attendeeCount}/{event.maxAttendees}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
  },
  imageContainer: {
    height: 150,
    width: '100%',
    position: 'relative',
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
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  contentContainer: {
    padding: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 6,
  },
  conditionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    marginBottom: 8,
  },
  conditionBadge: {
    marginRight: 6,
    marginBottom: 6,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  attendeeText: {
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  capacityContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  capacityText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default EventCard;

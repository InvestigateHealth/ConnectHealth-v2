// src/utils/dateUtils.js
// Utilities for date formatting and handling

import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

/**
 * Format a timestamp for display in the app.
 * 
 * @param {Date|Timestamp|number|string} timestamp - Firebase timestamp, Date object, timestamp in ms, or ISO string
 * @param {boolean} useRelative - Whether to use relative time for recent dates
 * @returns {string} Formatted date string
 */
export const formatTimestamp = (timestamp, useRelative = true) => {
  if (!timestamp) return '';
  
  try {
    // Parse the timestamp into a Date object based on its type
    let date;
    
    if (typeof timestamp === 'string') {
      // Handle ISO string
      date = parseISO(timestamp);
    } else if (typeof timestamp === 'number') {
      // Handle timestamp in milliseconds
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      // Handle Firebase Timestamp objects
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      // Handle Date object
      date = timestamp;
    } else {
      return '';
    }
    
    if (!isValid(date)) {
      return '';
    }
    
    // For recent dates, use relative time if requested
    if (useRelative && new Date() - date < 24 * 60 * 60 * 1000) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    
    // Otherwise use standard date format
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
};

/**
 * Format full date time for detailed views
 * 
 * @param {Date|Timestamp|number|string} timestamp - Firebase timestamp, Date object, timestamp in ms, or ISO string
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    // Parse the timestamp into a Date object based on its type
    let date;
    
    if (typeof timestamp === 'string') {
      // Handle ISO string
      date = parseISO(timestamp);
    } else if (typeof timestamp === 'number') {
      // Handle timestamp in milliseconds
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      // Handle Firebase Timestamp objects
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      // Handle Date object
      date = timestamp;
    } else {
      return '';
    }
    
    if (!isValid(date)) {
      return '';
    }
    
    return format(date, 'MMM d, yyyy h:mm a');
  } catch (error) {
    console.error('Error formatting date time:', error);
    return '';
  }
};

/**
 * Format time only
 * 
 * @param {Date|Timestamp|number|string} timestamp - Firebase timestamp, Date object, timestamp in ms, or ISO string
 * @returns {string} Formatted time
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    // Parse the timestamp into a Date object based on its type
    let date;
    
    if (typeof timestamp === 'string') {
      // Handle ISO string
      date = parseISO(timestamp);
    } else if (typeof timestamp === 'number') {
      // Handle timestamp in milliseconds
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      // Handle Firebase Timestamp objects
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      // Handle Date object
      date = timestamp;
    } else {
      return '';
    }
    
    if (!isValid(date)) {
      return '';
    }
    
    return format(date, 'h:mm a');
  } catch (error) {
    console.error('Error formatting time:', error);
    return '';
  }
};

/**
 * Format join date for user profiles
 * 
 * @param {Date|Timestamp|number|string} timestamp - Firebase timestamp, Date object, timestamp in ms, or ISO string
 * @returns {string} Formatted join date
 */
export const formatJoinDate = (timestamp) => {
  if (!timestamp) return 'Recently';
  
  try {
    // Parse the timestamp into a Date object based on its type
    let date;
    
    if (typeof timestamp === 'string') {
      // Handle ISO string
      date = parseISO(timestamp);
    } else if (typeof timestamp === 'number') {
      // Handle timestamp in milliseconds
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      // Handle Firebase Timestamp objects
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      // Handle Date object
      date = timestamp;
    } else {
      return 'Recently';
    }
    
    if (!isValid(date)) {
      return 'Recently';
    }
    
    return format(date, 'MMMM yyyy');
  } catch (error) {
    console.error('Error formatting join date:', error);
    return 'Recently';
  }
};

/**
 * Get relative time (e.g., 5 minutes ago, 2 hours ago)
 * 
 * @param {Date|Timestamp|number|string} timestamp - Firebase timestamp, Date object, timestamp in ms, or ISO string
 * @returns {string} Relative time
 */
export const getRelativeTime = (timestamp) => {
  if (!timestamp) return '';
  
  try {
    // Parse the timestamp into a Date object based on its type
    let date;
    
    if (typeof timestamp === 'string') {
      // Handle ISO string
      date = parseISO(timestamp);
    } else if (typeof timestamp === 'number') {
      // Handle timestamp in milliseconds
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      // Handle Firebase Timestamp objects
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      // Handle Date object
      date = timestamp;
    } else {
      return '';
    }
    
    if (!isValid(date)) {
      return '';
    }
    
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error getting relative time:', error);
    return '';
  }
};

/**
 * Format date range (e.g., Jan 1 - Jan 5, 2023)
 * 
 * @param {Date|Timestamp|number|string} startDate - Start date
 * @param {Date|Timestamp|number|string} endDate - End date
 * @returns {string} Formatted date range
 */
export const formatDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return '';
  
  try {
    // Parse the dates
    let start;
    let end;
    
    // Handle start date
    if (typeof startDate === 'string') {
      start = parseISO(startDate);
    } else if (typeof startDate === 'number') {
      start = new Date(startDate);
    } else if (startDate.toDate) {
      start = startDate.toDate();
    } else if (startDate instanceof Date) {
      start = startDate;
    } else {
      return '';
    }
    
    // Handle end date
    if (typeof endDate === 'string') {
      end = parseISO(endDate);
    } else if (typeof endDate === 'number') {
      end = new Date(endDate);
    } else if (endDate.toDate) {
      end = endDate.toDate();
    } else if (endDate instanceof Date) {
      end = endDate;
    } else {
      return '';
    }
    
    if (!isValid(start) || !isValid(end)) {
      return '';
    }
    
    // Same year
    if (start.getFullYear() === end.getFullYear()) {
      // Same month
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
      }
      // Different month
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    
    // Different year
    return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
  } catch (error) {
    console.error('Error formatting date range:', error);
    return '';
  }
};

/**
 * Format duration in seconds to readable format (e.g., 1h 30m)
 * 
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return '';
  
  try {
    const totalSeconds = Math.floor(seconds);
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  } catch (error) {
    console.error('Error formatting duration:', error);
    return '';
  }
};

/**
 * Check if a date is today
 * 
 * @param {Date|Timestamp|number|string} date - Date to check
 * @returns {boolean} Whether the date is today
 */
export const isToday = (date) => {
  if (!date) return false;
  
  try {
    // Parse the date
    let dateObj;
    
    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date.toDate) {
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return false;
    }
    
    if (!isValid(dateObj)) {
      return false;
    }
    
    const today = new Date();
    
    return (
      dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear()
    );
  } catch (error) {
    console.error('Error checking if date is today:', error);
    return false;
  }
};

/**
 * Convert Firebase timestamp to Date object safely
 * 
 * @param {Timestamp|any} timestamp - Firebase timestamp or other value
 * @returns {Date|null} Date object or null if invalid
 */
export const toDate = (timestamp) => {
  if (!timestamp) return null;
  
  try {
    if (timestamp.toDate) {
      return timestamp.toDate();
    } else if (timestamp instanceof Date) {
      return timestamp;
    } else if (typeof timestamp === 'number') {
      return new Date(timestamp);
    } else if (typeof timestamp === 'string') {
      const date = parseISO(timestamp);
      return isValid(date) ? date : null;
    }
    
    return null;
  } catch (error) {
    console.error('Error converting to date:', error);
    return null;
  }
};

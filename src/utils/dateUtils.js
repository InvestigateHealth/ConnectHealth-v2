// src/utils/dateUtils.js
// Date utility functions for the app

import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth, isThisYear, parseISO } from 'date-fns';

/**
 * Format a timestamp into a relative time string (e.g., "2 hours ago")
 * 
 * @param {Date|string|number} date - The date to format
 * @param {Object} options - Format options
 * @returns {string} Formatted relative time
 */
export const timeAgo = (date, options = {}) => {
  if (!date) return '';
  
  try {
    // Convert to Date object if it's not already
    const dateObj = typeof date === 'string' ? parseISO(date) : date instanceof Date ? date : new Date(date);
    
    return formatDistanceToNow(dateObj, {
      addSuffix: true,
      ...options,
    });
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return '';
  }
};

/**
 * Format a timestamp into a smart date string based on how recent it is
 * 
 * @param {Date|string|number} date - The date to format
 * @returns {string} Formatted date string
 */
export const smartDateFormat = (date) => {
  if (!date) return '';
  
  try {
    // Convert to Date object if it's not already
    const dateObj = typeof date === 'string' ? parseISO(date) : date instanceof Date ? date : new Date(date);
    
    if (isToday(dateObj)) {
      return format(dateObj, "'Today at' h:mm a");
    } else if (isYesterday(dateObj)) {
      return format(dateObj, "'Yesterday at' h:mm a");
    } else if (isThisWeek(dateObj)) {
      return format(dateObj, "EEEE 'at' h:mm a");
    } else if (isThisMonth(dateObj)) {
      return format(dateObj, "MMMM d 'at' h:mm a");
    } else if (isThisYear(dateObj)) {
      return format(dateObj, "MMMM d");
    } else {
      return format(dateObj, "MMMM d, yyyy");
    }
  } catch (error) {
    console.error('Error formatting smart date:', error);
    return '';
  }
};

/**
 * Format a date for a calendar or schedule display
 * 
 * @param {Date|string|number} date - The date to format
 * @returns {string} Formatted date string
 */
export const calendarDateFormat = (date) => {
  if (!date) return '';
  
  try {
    // Convert to Date object if it's not already
    const dateObj = typeof date === 'string' ? parseISO(date) : date instanceof Date ? date : new Date(date);
    
    return format(dateObj, 'EEEE, MMMM d, yyyy');
  } catch (error) {
    console.error('Error formatting calendar date:', error);
    return '';
  }
};

/**
 * Format a time for display
 * 
 * @param {Date|string|number} date - The date to extract time from
 * @param {boolean} includeSeconds - Whether to include seconds
 * @returns {string} Formatted time string
 */
export const timeFormat = (date, includeSeconds = false) => {
  if (!date) return '';
  
  try {
    // Convert to Date object if it's not already
    const dateObj = typeof date === 'string' ? parseISO(date) : date instanceof Date ? date : new Date(date);
    
    return format(dateObj, includeSeconds ? 'h:mm:ss a' : 'h:mm a');
  } catch (error) {
    console.error('Error formatting time:', error);
    return '';
  }
};

/**
 * Format date range for event display
 * 
 * @param {Date|string|number} startDate - Start date
 * @param {Date|string|number} endDate - End date
 * @returns {string} Formatted date range
 */
export const dateRangeFormat = (startDate, endDate) => {
  if (!startDate || !endDate) return '';
  
  try {
    // Convert to Date objects if they're not already
    const startDateObj = typeof startDate === 'string' ? parseISO(startDate) : startDate instanceof Date ? startDate : new Date(startDate);
    const endDateObj = typeof endDate === 'string' ? parseISO(endDate) : endDate instanceof Date ? endDate : new Date(endDate);
    
    // Same day
    if (
      startDateObj.getFullYear() === endDateObj.getFullYear() &&
      startDateObj.getMonth() === endDateObj.getMonth() &&
      startDateObj.getDate() === endDateObj.getDate()
    ) {
      return `${format(startDateObj, 'MMMM d, yyyy')} · ${format(startDateObj, 'h:mm a')} - ${format(endDateObj, 'h:mm a')}`;
    }
    
    // Same month
    if (
      startDateObj.getFullYear() === endDateObj.getFullYear() &&
      startDateObj.getMonth() === endDateObj.getMonth()
    ) {
      return `${format(startDateObj, 'MMMM d')} - ${format(endDateObj, 'd, yyyy')}`;
    }
    
    // Same year
    if (startDateObj.getFullYear() === endDateObj.getFullYear()) {
      return `${format(startDateObj, 'MMMM d')} - ${format(endDateObj, 'MMMM d, yyyy')}`;
    }
    
    // Different years
    return `${format(startDateObj, 'MMMM d, yyyy')} - ${format(endDateObj, 'MMMM d, yyyy')}`;
  } catch (error) {
    console.error('Error formatting date range:', error);
    return '';
  }
};

/**
 * Get the current date at midnight (start of day)
 * 
 * @returns {Date} Date object at start of current day
 */
export const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Get the date at the end of the current day (23:59:59.999)
 * 
 * @returns {Date} Date object at end of current day
 */
export const endOfToday = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

/**
 * Check if a date is in the past
 * 
 * @param {Date|string|number} date - The date to check
 * @returns {boolean} Whether the date is in the past
 */
export const isPast = (date) => {
  if (!date) return false;
  
  try {
    // Convert to Date object if it's not already
    const dateObj = typeof date === 'string' ? parseISO(date) : date instanceof Date ? date : new Date(date);
    
    return dateObj < new Date();
  } catch (error) {
    console.error('Error checking if date is in past:', error);
    return false;
  }
};

/**
 * Check if a date is in the future
 * 
 * @param {Date|string|number} date - The date to check
 * @returns {boolean} Whether the date is in the future
 */
export const isFuture = (date) => {
  if (!date) return false;
  
  try {
    // Convert to Date object if it's not already
    const dateObj = typeof date === 'string' ? parseISO(date) : date instanceof Date ? date : new Date(date);
    
    return dateObj > new Date();
  } catch (error) {
    console.error('Error checking if date is in future:', error);
    return false;
  }
};

export default {
  timeAgo,
  smartDateFormat,
  calendarDateFormat,
  timeFormat,
  dateRangeFormat,
  startOfToday,
  endOfToday,
  isPast,
  isFuture,
};
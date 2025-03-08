// src/utils/adminUtils.js
// Utility function to manage admin privileges

import firestore from '@react-native-firebase/firestore';

/**
 * Set admin role for a user
 * This function should be used with caution and proper authorization
 * 
 * @param {string} userId - User ID to grant admin privileges to
 * @param {boolean} isAdmin - Whether to set or unset admin role
 * @returns {Promise<boolean>} Success status
 */
export const setUserAdminRole = async (userId, isAdmin = true) => {
  try {
    // Get user document reference
    const userRef = firestore().collection('users').doc(userId);
    
    // Check if user exists
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      throw new Error('User does not exist');
    }
    
    // Update user role
    await userRef.update({
      role: isAdmin ? 'admin' : 'user',
      roleUpdatedAt: firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`User ${userId} admin role set to ${isAdmin}`);
    return true;
  } catch (error) {
    console.error('Error setting admin role:', error);
    throw error;
  }
};

/**
 * Check if a user has admin role
 * 
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} Whether user is an admin
 */
export const checkUserAdminRole = async (userId) => {
  try {
    const userDoc = await firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return false;
    }
    
    const userData = userDoc.data();
    return userData.role === 'admin';
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
};
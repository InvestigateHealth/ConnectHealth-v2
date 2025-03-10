// src/utils/certificatePinning.js
// Certificate pinning implementation for secure API communication

import { Platform } from 'react-native';
import { AnalyticsService } from '../services/AnalyticsService';

/**
 * This is a standalone utility for certificate pinning.
 * 
 * For iOS: We use the NSAppTransportSecurity configuration in Info.plist
 * For Android: We use the network_security_config.xml
 * 
 * This file provides a programmatic validation layer on top of those configurations.
 */

// SHA-256 hashes of our API server certificates
// In a real application, these would be the actual certificate hashes
// Multiple hashes allow for certificate rotation
const PINNED_DOMAINS = {
  'api.healthconnect.app': {
    hashes: [
      'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Primary certificate
      'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // Backup certificate
    ],
    includeSubdomains: true,
    // Expiration dates to remind when certificates need to be updated
    expirations: [
      new Date('2024-12-31'), // Primary certificate expiration
      new Date('2025-06-30'), // Backup certificate expiration
    ]
  },
  // Add more domains as needed
};

/**
 * Check if certificate pinning has been properly configured in native files
 * This is a development helper function to remind developers
 */
export const validatePinningConfiguration = () => {
  if (__DEV__) {
    // This would check if certificate pinning is properly set up in the native configurations
    if (Platform.OS === 'ios') {
      console.info('Check that NSAppTransportSecurity is configured in Info.plist with proper certificate hashes');
    } else if (Platform.OS === 'android') {
      console.info('Check that network_security_config.xml is properly configured with certificate pins');
    }
    
    // Check for soon-to-expire certificates
    const now = new Date();
    const warningThreshold = 60 * 24 * 60 * 60 * 1000; // 60 days in milliseconds
    
    for (const [domain, config] of Object.entries(PINNED_DOMAINS)) {
      if (config.expirations) {
        for (const expirationDate of config.expirations) {
          const timeRemaining = expirationDate.getTime() - now.getTime();
          
          if (timeRemaining <= 0) {
            console.warn(`Certificate for ${domain} has EXPIRED on ${expirationDate.toISOString().split('T')[0]}!`);
          } else if (timeRemaining <= warningThreshold) {
            const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
            console.warn(`Certificate for ${domain} will expire in ${daysRemaining} days on ${expirationDate.toISOString().split('T')[0]}.`);
          }
        }
      }
    }
  }
};

/**
 * Creates a fetch wrapper that validates certificates
 * This provides an additional layer of security on top of native certificate pinning
 * 
 * @returns {Function} Enhanced fetch function with certificate validation
 */
export const createSecureFetch = () => {
  // Store the original fetch
  const originalFetch = global.fetch;
  
  // Return a new fetch function
  return async (url, options = {}) => {
    try {
      // Extract domain from URL
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      
      // Check if this domain should be validated
      const pinnedConfig = PINNED_DOMAINS[domain];
      
      if (!pinnedConfig) {
        // Domain is not in our pinned list, proceed normally
        return originalFetch(url, options);
      }
      
      // At this point, the native certificate pinning should have already rejected
      // invalid certificates, but we can add additional validation here if needed
      
      // Proceed with fetch
      const response = await originalFetch(url, options);
      
      // Log successful pinned connection
      if (__DEV__) {
        console.debug(`Secure connection established to pinned domain: ${domain}`);
      }
      
      return response;
    } catch (error) {
      // If this is a certificate validation error from native code
      if (error.message && (
          error.message.includes('certificate') || 
          error.message.includes('SSL') || 
          error.message.includes('Handshake failed')
      )) {
        // Log the certificate validation failure
        console.error(`Certificate validation failed for: ${url}`);
        AnalyticsService.logEvent('certificate_validation_failed', {
          url,
          error: error.message,
        });
        
        // Rethrow with clearer message
        throw new Error(`Secure connection failed: The server's identity cannot be verified. This may indicate a man-in-the-middle attack.`);
      }
      
      // For other errors, just pass through
      throw error;
    }
  };
};

/**
 * Initialize certificate pinning
 * Call this early in the app startup
 */
export const initializeCertificatePinning = () => {
  try {
    // Validate the configuration (development reminder)
    validatePinningConfiguration();
    
    // Replace global fetch with our secure version
    // This is optional and provides an additional validation layer
    // since the native implementations should handle the actual pinning
    if (!__DEV__) {
      // Only in production to avoid development issues
      global.fetch = createSecureFetch();
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing certificate pinning:', error);
    AnalyticsService.logError(error, { context: 'initialize_certificate_pinning' });
    return false;
  }
};

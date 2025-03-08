// src/components/LinkPreview.js
// Component for displaying rich link previews in posts

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { AccessibleImage } from './AccessibleImage';
import { getDomainFromUrl } from '../utils/firebaseUtils';

const LinkPreview = ({ url, style }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [linkData, setLinkData] = useState(null);
  const [imageError, setImageError] = useState(false);

  // Fetch link preview data when component mounts
  useEffect(() => {
    if (!url) {
      setError('No URL provided');
      setLoading(false);
      return;
    }

    fetchLinkPreview();
  }, [url]);

  // Fetch link preview metadata
  const fetchLinkPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      // Ensure URL has protocol
      let formattedUrl = url;
      if (!/^https?:\/\//i.test(url)) {
        formattedUrl = 'https://' + url;
      }

      // Use a link preview service or API
      // Note: In a production app, you'd want to use a service like
      // LinkPreview.io, Microlink, or your own backend proxy
      const response = await fetch(`https://api.linkpreview.net/?key=YOUR_API_KEY&q=${encodeURIComponent(formattedUrl)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch link preview');
      }

      const data = await response.json();
      
      setLinkData({
        title: data.title || 'No title',
        description: data.description || 'No description available',
        image: data.image,
        url: data.url,
        domain: getDomainFromUrl(data.url)
      });
    } catch (error) {
      console.error('Error fetching link preview:', error);
      
      // Fallback to basic preview
      setLinkData({
        title: 'Link Preview',
        description: 'Click to open link',
        image: null,
        url: formattedUrl,
        domain: getDomainFromUrl(formattedUrl)
      });
      
      setError('Failed to load link preview');
    } finally {
      setLoading(false);
    }
  };

  // Handle opening the link
  const handleOpenLink = () => {
    if (!linkData?.url) return;
    
    Linking.canOpenURL(linkData.url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(linkData.url);
        } else {
          console.error('Cannot open URL:', linkData.url);
        }
      })
      .catch((error) => {
        console.error('Error opening URL:', error);
      });
  };

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="small" color="#2196F3" />
        <Text style={styles.loadingText}>Loading link preview...</Text>
      </View>
    );
  }

  // Show error state
  if (error && !linkData) {
    return (
      <TouchableOpacity 
        style={[styles.container, styles.errorContainer, style]}
        onPress={() => Linking.openURL(url)}
      >
        <Icon name="link-outline" size={24} color="#F44336" />
        <Text style={styles.errorText}>Could not load preview</Text>
        <Text style={styles.urlText}>{url}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.container, style]}
      onPress={handleOpenLink}
      accessibilityLabel={`Link to ${linkData?.title}. Tap to open.`}
      accessibilityRole="link"
    >
      {!imageError && linkData?.image && (
        <View style={styles.imageContainer}>
          <AccessibleImage
            source={{ uri: linkData.image }}
            style={styles.image}
            contentDescription={`Preview image for ${linkData.title}`}
            onError={() => setImageError(true)}
          />
        </View>
      )}
      
      <View style={styles.contentContainer}>
        <Text style={styles.domain}>{linkData?.domain}</Text>
        <Text 
          style={styles.title}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {linkData?.title}
        </Text>
        
        <Text 
          style={styles.description}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {linkData?.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#CFD8DC',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  loadingText: {
    marginTop: 8,
    color: '#546E7A',
    fontSize: 14,
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  errorText: {
    marginTop: 8,
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
  },
  urlText: {
    marginTop: 4,
    color: '#78909C',
    fontSize: 12,
  },
  imageContainer: {
    width: '100%',
    height: 150,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    padding: 12,
  },
  domain: {
    fontSize: 12,
    color: '#78909C',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#546E7A',
  },
});

export default LinkPreview;

// src/components/LinkPreview.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { getLinkPreview } from 'react-native-link-preview';
import Icon from 'react-native-vector-icons/Feather';
import SocialMediaUtils from '../utils/socialMediaUtils';
import { useTheme } from '../theme/ThemeContext';

const { width } = Dimensions.get('window');

const LinkPreview = ({ url, onPress, style }) => {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socialPlatform, setSocialPlatform] = useState(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }

    // Detect if this is a social media URL
    const platform = SocialMediaUtils.detectPlatform(url);
    setSocialPlatform(platform);

    // Fetch preview data
    const fetchPreviewData = async () => {
      try {
        setLoading(true);
        
        const data = await getLinkPreview(url, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });
        
        setPreviewData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching link preview:', err);
        setError('Could not load preview');
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewData();
  }, [url]);

  // If no URL is provided, don't render anything
  if (!url) {
    return null;
  }

  // While loading, show a loading indicator
  if (loading) {
    return (
      <View style={[styles.container, style, { height: 100, justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color={theme?.colors?.primary?.main || '#007AFF'} />
      </View>
    );
  }

  // If there was an error or no preview data, show a simple link
  if (error || !previewData) {
    return (
      <TouchableOpacity
        style={[styles.errorContainer, style]}
        onPress={() => onPress && onPress(url)}
      >
        <Icon name="link" size={16} color={theme?.colors?.primary?.main || '#007AFF'} />
        <Text style={[styles.errorText, { color: theme?.colors?.primary?.main || '#007AFF' }]} numberOfLines={1}>
          {url}
        </Text>
      </TouchableOpacity>
    );
  }

  // Determine what icon to show based on social platform
  const renderPlatformIcon = () => {
    if (!socialPlatform) return null;

    return (
      <View style={[styles.platformIcon, { backgroundColor: socialPlatform.color }]}>
        <Icon name={socialPlatform.icon} size={14} color="#FFFFFF" />
      </View>
    );
  };

  // Render the preview
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() => onPress && onPress(url)}
      activeOpacity={0.8}
    >
      {renderPlatformIcon()}

      <View style={styles.contentContainer}>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme?.colors?.text?.primary || '#000000' }]} numberOfLines={2}>
            {previewData.title || 'No title'}
          </Text>
          
          {previewData.description && (
            <Text style={[styles.description, { color: theme?.colors?.text?.secondary || '#666666' }]} numberOfLines={2}>
              {previewData.description}
            </Text>
          )}
          
          <Text style={[styles.url, { color: theme?.colors?.text?.disabled || '#999999' }]} numberOfLines={1}>
            {previewData.url}
          </Text>
        </View>

        {previewData.images && previewData.images.length > 0 ? (
          <FastImage
            style={styles.image}
            source={{ uri: previewData.images[0] }}
            resizeMode={FastImage.resizeMode.cover}
          />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: theme?.colors?.background?.default || '#EEEEEE' }]}>
            <Icon name="image" size={24} color={theme?.colors?.text?.disabled || '#999999'} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  contentContainer: {
    flexDirection: 'row',
    padding: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    marginBottom: 4,
  },
  url: {
    fontSize: 12,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#EEEEEE',
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
  },
  platformIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});

export default LinkPreview;

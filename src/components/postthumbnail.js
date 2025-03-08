// src/components/PostThumbnail.js
// Component for displaying post thumbnails in a grid

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');
const itemSize = (width - 6) / 3; // 3 columns with 2px spacing between items

const PostThumbnail = ({ post, onPress }) => {
  // Choose the appropriate icon based on post type
  const renderPostTypeIcon = () => {
    switch (post.type) {
      case 'video':
        return <Icon name="play-circle" size={24} color="white" />;
      case 'link':
        return <Icon name="link" size={20} color="white" />;
      default:
        return null;
    }
  };

  // For post types other than image, we'll show a colored background with an icon
  const renderContent = () => {
    if (post.type === 'image' && post.content) {
      return (
        <FastImage
          style={styles.image}
          source={{ uri: post.content }}
          resizeMode={FastImage.resizeMode.cover}
        />
      );
    } else {
      let backgroundColor = '#9E9E9E'; // Default gray
      
      if (post.type === 'video') {
        backgroundColor = '#4CAF50'; // Green for videos
      } else if (post.type === 'link') {
        backgroundColor = '#2196F3'; // Blue for links
      }
      
      return (
        <View style={[styles.placeholderContainer, { backgroundColor }]}>
          {renderPostTypeIcon()}
        </View>
      );
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: itemSize,
    height: itemSize,
    margin: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PostThumbnail;

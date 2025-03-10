// src/components/social/LinkPreview.js
// Component for previewing shared links

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import FastImage from 'react-native-fast-image';
import { getLinkPreview } from 'react-native-link-preview';
import { useTheme } from '../../theme/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * Get domain name from URL
 * @param {string} url - The URL
 * @returns {string} Domain name
 */
const getDomainFromURL = (url) => {
  try {
    const domain = new URL(url);
    return domain.hostname.replace('www.', '');
  } catch (e) {
    return url;
  }
};

/**
 * Component to preview external links
 * @param {Object} props - Component props
 * @param {string} props.url - The URL to preview
 * @param {Object} props.style - Container style
 * @param {Function} props.onPress - Callback when preview is pressed
 * @param {boolean} props.compact - Whether to use compact layout
 */
const LinkPreview = ({ url, style, onPress, compact = false }) => {
  const { theme } = useTheme();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  useEffect(() => {
    const fetchPreview = async () => {
      if (!url) return;
      
      try {
        setLoading(true);
        setError(false);
        
        const data = await getLinkPreview(url, {
          timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
          },
        });
        
        if (data) {
          setPreview(data);
        }
      } catch (err) {
        console.error('Error fetching link preview:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPreview();
  }, [url]);
  
  const handlePress = () => {
    if (onPress) {
      onPress(url);
    } else {
      Linking.openURL(url);
    }
  };
  
  if (error || !preview) {
    return (
      <TouchableOpacity
        style={[
          styles.container,
          { backgroundColor: theme.colors.background.card },
          style
        ]}
        onPress={handlePress}
      >
        <View style={styles.simpleContent}>
          <Icon
            name="link-variant"
            size={20}
            color={theme.colors.primary.main}
            style={styles.linkIcon}
          />
          <Text
            style={[styles.url, { color: theme.colors.primary.main }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {url}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }
  
  if (compact) {
    return (
      <TouchableOpacity
        style={[
          styles.compactContainer,
          { backgroundColor: theme.colors.background.card },
          style
        ]}
        onPress={handlePress}
      >
        {preview.images && preview.images.length > 0 && (
          <FastImage
            source={{ uri: preview.images[0] }}
            style={styles.compactImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.compactContent}>
          <Text
            style={[styles.compactTitle, { color: theme.colors.text.primary }]}
            numberOfLines={1}
          >
            {preview.title || getDomainFromURL(url)}
          </Text>
          
          <Text
            style={[styles.domain, { color: theme.colors.text.secondary }]}
            numberOfLines={1}
          >
            {getDomainFromURL(preview.url || url)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }
  
  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: theme.colors.background.card },
        style
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {preview.images && preview.images.length > 0 && (
        <FastImage
          source={{ uri: preview.images[0] }}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      
      <View style={styles.content}>
        <Text
          style={[styles.domain, { color: theme.colors.text.secondary }]}
          numberOfLines={1}
        >
          {getDomainFromURL(preview.url || url)}
        </Text>
        
        <Text
          style={[styles.title, { color: theme.colors.text.primary }]}
          numberOfLines={2}
        >
          {preview.title || ''}
        </Text>
        
        {preview.description && (
          <Text
            style={[styles.description, { color: theme.colors.text.secondary }]}
            numberOfLines={2}
          >
            {preview.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    overflow: 'hidden',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default SocialShareButtons;

// src/components/social/CommentItem.js
// Component for individual comment with reply functionality

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import { timeAgo } from '../../utils/dateUtils';
import CachedImage from '../ui/CachedImage';
import Icon from 'react-native-vector-icons/MaterialIcons';

/**
 * Comment item component
 * @param {Object} props - Component props
 * @param {Object} props.comment - Comment data
 * @param {Function} props.onReply - Callback when reply is submitted
 * @param {Function} props.onDelete - Callback when delete is pressed
 * @param {Function} props.onReport - Callback when report is pressed
 * @param {Function} props.onLike - Callback when like is pressed
 * @param {Function} props.onUserPress - Callback when username is pressed
 * @param {boolean} props.isReply - Whether this is a reply to another comment
 */
const CommentItem = ({
  comment,
  onReply,
  onDelete,
  onReport,
  onLike,
  onUserPress,
  isReply = false
}) => {
  const { theme } = useTheme();
  const { user } = useUser();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  
  const {
    id,
    userId,
    username,
    profileImage,
    text,
    timestamp,
    likeCount = 0,
    isLiked = false,
    replyCount = 0,
    replies = []
  } = comment;
  
  const formattedTimestamp = timeAgo(timestamp);
  const isCurrentUser = user && user.uid === userId;
  
  const handleReplySubmit = () => {
    if (replyText.trim() && onReply) {
      onReply(id, replyText);
      setReplyText('');
      setShowReplyInput(false);
    }
  };
  
  const toggleReplyInput = () => {
    setShowReplyInput(!showReplyInput);
    if (!showReplyInput) {
      setShowOptions(false);
    }
  };
  
  const toggleOptions = () => {
    setShowOptions(!showOptions);
    if (!showOptions) {
      setShowReplyInput(false);
    }
  };
  
  const handleUserPress = () => {
    if (onUserPress) {
      onUserPress(userId, username);
    }
  };
  
  const handleLikePress = () => {
    if (onLike) {
      onLike(id, !isLiked);
    }
  };
  
  const handleDelete = () => {
    if (onDelete) {
      onDelete(id);
    }
    setShowOptions(false);
  };
  
  const handleReport = () => {
    if (onReport) {
      onReport(id);
    }
    setShowOptions(false);
  };
  
  return (
    <View style={[
      styles.container,
      isReply && styles.replyContainer
    ]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleUserPress}>
          <CachedImage
            source={{ uri: profileImage }}
            style={styles.profileImage}
          />
        </TouchableOpacity>
        
        <View style={styles.contentContainer}>
          <View style={styles.nameTimeContainer}>
            <TouchableOpacity onPress={handleUserPress}>
              <Text style={[styles.username, { color: theme.colors.text.primary }]}>
                {username}
              </Text>
            </TouchableOpacity>
            
            <Text style={[styles.timestamp, { color: theme.colors.text.secondary }]}>
              {formattedTimestamp}
            </Text>
          </View>
          
          <Text style={[styles.commentText, { color: theme.colors.text.primary }]}>
            {text}
          </Text>
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleLikePress}
            >
              <Icon
                name={isLiked ? 'favorite' : 'favorite-border'}
                size={16}
                color={isLiked ? theme.colors.error.main : theme.colors.text.secondary}
              />
              {likeCount > 0 && (
                <Text style={[styles.actionText, { color: theme.colors.text.secondary }]}>
                  {likeCount}
                </Text>
              )}
            </TouchableOpacity>
            
            {!isReply && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={toggleReplyInput}
              >
                <Icon
                  name="reply"
                  size={16}
                  color={theme.colors.text.secondary}
                />
                {replyCount > 0 && (
                  <Text style={[styles.actionText, { color: theme.colors.text.secondary }]}>
                    {replyCount}
                  </Text>
                )}
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={toggleOptions}
            >
              <Icon
                name="more-horiz"
                size={16}
                color={theme.colors.text.secondary}
              />
            </TouchableOpacity>
          </View>
          
          {showOptions && (
            <View style={[styles.optionsContainer, { backgroundColor: theme.colors.background.card }]}>
              {isCurrentUser ? (
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={handleDelete}
                >
                  <Icon
                    name="delete"
                    size={16}
                    color={theme.colors.error.main}
                  />
                  <Text style={[styles.optionText, { color: theme.colors.error.main }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={handleReport}
                >
                  <Icon
                    name="flag"
                    size={16}
                    color={theme.colors.warning.main}
                  />
                  <Text style={[styles.optionText, { color: theme.colors.warning.main }]}>
                    Report
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {showReplyInput && (
            <View style={styles.replyInputContainer}>
              <TextInput
                style={[
                  styles.replyInput,
                  {
                    backgroundColor: theme.colors.background.input,
                    color: theme.colors.text.primary,
                    borderColor: theme.colors.border,
                  }
                ]}
                placeholder="Write a reply..."
                placeholderTextColor={theme.colors.text.hint}
                value={replyText}
                onChangeText={setReplyText}
                multiline
                maxLength={500}
              />
              
              <TouchableOpacity
                style={[
                  styles.replyButton,
                  {
                    backgroundColor: theme.colors.primary.main,
                    opacity: replyText.trim() ? 1 : 0.6,
                  }
                ]}
                onPress={handleReplySubmit}
                disabled={!replyText.trim()}
              >
                <Icon
                  name="send"
                  size={16}
                  color={theme.colors.primary.contrastText}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
      
      {replies && replies.length > 0 && !isReply && (
        <View style={styles.repliesContainer}>
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onDelete={onDelete}
              onReport={onReport}
              onLike={onLike}
              onUserPress={onUserPress}
              isReply
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  replyContainer: {
    marginLeft: 24,
    marginTop: 8,
    marginBottom: 8,
    paddingLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#E0E0E0',
  },
  header: {
    flexDirection: 'row',
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  nameTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontWeight: '600',
    fontSize: 14,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 12,
    marginLeft: 4,
  },
  optionsContainer: {
    position: 'absolute',
    right: 0,
    top: 30,
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  optionText: {
    marginLeft: 8,
    fontSize: 14,
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
  },
  replyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  repliesContainer: {
    marginTop: 8,
    marginLeft: 48,
  },
});

export default CommentItem; width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  image: {
    height: 150,
    width: '100%',
  },
  content: {
    padding: 12,
  },
  domain: {
    fontSize: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  simpleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  linkIcon: {
    marginRight: 8,
  },
  url: {
    flex: 1,
    fontSize: 14,
  },
  compactContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 4,
    height: 60,
  },
  compactImage: {
    width: 60,
    height: 60,
  },
  compactContent: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
});

export default LinkPreview;

// src/components/social/SocialShareButtons.js
// Component for social media sharing buttons

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import RNShare from 'react-native-share';
import Config from 'react-native-config';

/**
 * Social sharing buttons component
 * @param {Object} props - Component props
 * @param {string} props.title - Content title for sharing
 * @param {string} props.message - Content message for sharing
 * @param {string} props.url - URL to share
 * @param {Object} props.style - Container style
 * @param {Function} props.onShareSuccess - Callback on successful share
 * @param {Function} props.onShareError - Callback on share error
 * @param {boolean} props.compact - Whether to use compact layout
 * @param {Array} props.platforms - Platforms to include (defaults to all)
 */
const SocialShareButtons = ({
  title,
  message,
  url,
  style,
  onShareSuccess,
  onShareError,
  compact = false,
  platforms = ['facebook', 'twitter', 'instagram', 'linkedin', 'message', 'email', 'more']
}) => {
  const { theme } = useTheme();
  
  const shareBaseUrl = Config.SOCIAL_SHARE_BASE_URL || 'https://healthconnect.app/share';
  const fullUrl = url || `${shareBaseUrl}`;
  
  const handleShare = async (platform) => {
    try {
      let result;
      
      switch (platform) {
        case 'facebook':
          result = await RNShare.shareSingle({
            social: RNShare.Social.FACEBOOK,
            url: fullUrl,
            title: title,
            message: message,
          });
          break;
          
        case 'twitter':
          result = await RNShare.shareSingle({
            social: RNShare.Social.TWITTER,
            url: fullUrl,
            title: title,
            message: message,
          });
          break;
          
        case 'instagram':
          // Instagram requires an image to share
          Alert.alert(
            'Instagram Sharing',
            'To share on Instagram, you need to include an image.',
            [{ text: 'OK' }]
          );
          return;
          
        case 'linkedin':
          result = await RNShare.shareSingle({
            social: RNShare.Social.LINKEDIN,
            url: fullUrl,
            title: title,
            message: message,
          });
          break;
          
        case 'message':
          result = await RNShare.shareSingle({
            social: RNShare.Social.SMS,
            message: `${message} ${fullUrl}`,
          });
          break;
          
        case 'email':
          result = await RNShare.shareSingle({
            social: RNShare.Social.EMAIL,
            title: title,
            message: `${message}\n\n${fullUrl}`,
          });
          break;
          
        case 'more':
        default:
          result = await Share.share(
            {
              title: title,
              message: `${message} ${fullUrl}`,
              url: fullUrl,
            },
            {
              subject: title,
              dialogTitle: 'Share this content',
            }
          );
          break;
      }
      
      if (onShareSuccess && (result.action !== Share.dismissedAction)) {
        onShareSuccess(platform, result);
      }
    } catch (error) {
      console.error('Error sharing to ' + platform, error);
      if (onShareError) {
        onShareError(platform, error);
      }
    }
  };
  
  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'facebook':
        return 'facebook';
      case 'twitter':
        return 'twitter';
      case 'instagram':
        return 'instagram';
      case 'linkedin':
        return 'linkedin';
      case 'message':
        return 'message-text';
      case 'email':
        return 'email';
      case 'more':
      default:
        return 'share-variant';
    }
  };
  
  const getPlatformColor = (platform) => {
    switch (platform) {
      case 'facebook':
        return '#3b5998';
      case 'twitter':
        return '#1DA1F2';
      case 'instagram':
        return '#C13584';
      case 'linkedin':
        return '#0077B5';
      case 'message':
        return theme.colors.primary.main;
      case 'email':
        return theme.colors.secondary.main;
      case 'more':
      default:
        return theme.colors.text.secondary;
    }
  };
  
  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        {platforms.map((platform) => (
          <TouchableOpacity
            key={platform}
            style={[
              styles.compactButton,
              { backgroundColor: theme.colors.background.card }
            ]}
            onPress={() => handleShare(platform)}
          >
            <Icon
              name={getPlatformIcon(platform)}
              size={20}
              color={getPlatformColor(platform)}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  }
  
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.title, { color: theme.colors.text.secondary }]}>
        Share via
      </Text>
      
      <View style={styles.buttonContainer}>
        {platforms.map((platform) => (
          <TouchableOpacity
            key={platform}
            style={[
              styles.button,
              { backgroundColor: theme.colors.background.card }
            ]}
            onPress={() => handleShare(platform)}
          >
            <Icon
              name={getPlatformIcon(platform)}
              size={24}
              color={getPlatformColor(platform)}
            />
            <Text style={[styles.buttonText, { color: theme.colors.text.primary }]}>
              {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonText: {
    marginLeft: 8,
    fontWeight: '500',
  },
  compactContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
  },
  compactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    shadowColor: '#000',
    shadowOffset: {
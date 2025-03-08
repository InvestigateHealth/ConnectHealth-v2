// src/components/PostCard.js
// Updated with block user option

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActionSheetIOS,
  Platform
} from 'react-native';
import { Menu, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu';
import Icon from 'react-native-vector-icons/Ionicons';
import FastImage from 'react-native-fast-image';
import { format, formatDistanceToNow } from 'date-fns';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import LinkPreview from './LinkPreview';
import { useUser } from '../contexts/UserContext';
import BlockUserModal from './BlockUserModal';

const PostCard = ({ post, navigation, onCommentPress, onProfilePress }) => {
  const { isUserBlocked } = useUser();
  const [isLiked, setIsLiked] = useState(post.likes?.includes(auth().currentUser.uid) || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [userIsPostAuthor, setUserIsPostAuthor] = useState(false);
  
  useEffect(() => {
    // Check if current user is the post author
    setUserIsPostAuthor(post.userId === auth().currentUser.uid);
  }, [post.userId]);

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const postDate = new Date(timestamp);
    
    // If less than 24 hours ago, show relative time
    if (now - postDate < 24 * 60 * 60 * 1000) {
      return formatDistanceToNow(postDate, { addSuffix: true });
    }
    
    // Otherwise show the date
    return format(postDate, 'MMM d, yyyy');
  };

  const handleLikeToggle = async () => {
    const postRef = firestore().collection('posts').doc(post.id);
    const currentUserUid = auth().currentUser.uid;
    
    try {
      await firestore().runTransaction(async transaction => {
        const postDoc = await transaction.get(postRef);
        
        if (!postDoc.exists) {
          throw new Error('Post does not exist!');
        }
        
        const postData = postDoc.data();
        const likes = postData.likes || [];
        const userLiked = likes.includes(currentUserUid);
        
        if (userLiked) {
          // Remove like
          transaction.update(postRef, {
            likes: firestore.FieldValue.arrayRemove(currentUserUid),
            likeCount: firestore.FieldValue.increment(-1)
          });
          setIsLiked(false);
          setLikeCount(prev => prev - 1);
        } else {
          // Add like
          transaction.update(postRef, {
            likes: firestore.FieldValue.arrayUnion(currentUserUid),
            likeCount: firestore.FieldValue.increment(1)
          });
          setIsLiked(true);
          setLikeCount(prev => prev + 1);
        }
      });
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Could not update like status');
    }
  };

  const handleSharePost = () => {
    // Implement share functionality
    // This would typically use the Share API from react-native
    Alert.alert('Share', 'Sharing functionality would be implemented here');
  };

  const handleReportPost = () => {
    Alert.alert(
      'Report Post',
      'Are you sure you want to report this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Report', 
          style: 'destructive',
          onPress: () => {
            // Add report to database
            firestore().collection('reports').add({
              postId: post.id,
              reportedBy: auth().currentUser.uid,
              timestamp: firestore.FieldValue.serverTimestamp(),
              resolved: false
            });
            
            Alert.alert('Report Submitted', 'Thank you for your report. We will review this post.');
          }
        }
      ]
    );
  };
  
  const handleBlockSuccess = () => {
    Alert.alert(
      'User Blocked',
      `You have blocked ${post.userFullName}. Their posts will no longer appear in your feed.`
    );
  };

  // Use react-native-popup-menu instead of ActionSheetIOS for cross-platform
  const renderMoreOptions = () => (
    <Menu>
      <MenuTrigger>
        <Icon name="ellipsis-horizontal" size={20} color="#546E7A" />
      </MenuTrigger>
      <MenuOptions customStyles={{
        optionsContainer: styles.menuOptions,
      }}>
        <MenuOption onSelect={handleSharePost} customStyles={{
          optionWrapper: styles.menuOption,
        }}>
          <Icon name="share-outline" size={20} color="#546E7A" style={styles.menuIcon} />
          <Text style={styles.menuText}>Share</Text>
        </MenuOption>

        {!userIsPostAuthor && (
          <>
            <MenuOption onSelect={handleReportPost} customStyles={{
              optionWrapper: styles.menuOption,
            }}>
              <Icon name="flag-outline" size={20} color="#FF9800" style={styles.menuIcon} />
              <Text style={styles.menuText}>Report Post</Text>
            </MenuOption>
            
            <MenuOption onSelect={handleBlockUser} customStyles={{
              optionWrapper: styles.menuOption,
            }}>
              <Icon name="shield-outline" size={20} color="#F44336" style={styles.menuIcon} />
              <Text style={[styles.menuText, styles.dangerText]}>Block User</Text>
            </MenuOption>
          </>
        )}
        
        {userIsPostAuthor && (
          <MenuOption onSelect={handleDeletePost} customStyles={{
            optionWrapper: styles.menuOption,
          }}>
            <Icon name="trash-outline" size={20} color="#F44336" style={styles.menuIcon} />
            <Text style={[styles.menuText, styles.dangerText]}>Delete Post</Text>
          </MenuOption>
        )}
      </MenuOptions>
    </Menu>
  );

  const handleBlockUser = () => {
    setBlockModalVisible(true);
  };

  const handleDeletePost = () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the post
              await firestore().collection('posts').doc(post.id).delete();
              
              // Delete associated comments
              const commentsSnapshot = await firestore()
                .collection('comments')
                .where('postId', '==', post.id)
                .get();
              
              const batch = firestore().batch();
              commentsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
              });
              
              await batch.commit();
              
              Alert.alert('Success', 'Post deleted successfully');
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Render post content based on type
  const renderPostContent = () => {
    switch (post.type) {
      case 'image':
        return (
          <FastImage
            source={{ uri: post.content }}
            style={styles.postImage}
            resizeMode={FastImage.resizeMode.cover}
          />
        );
      case 'video':
        // Video component would go here
        return (
          <View style={styles.videoContainer}>
            <FastImage
              source={{ uri: post.thumbnailUrl || post.content }}
              style={styles.postImage}
              resizeMode={FastImage.resizeMode.cover}
            />
            <View style={styles.playButtonOverlay}>
              <Icon name="play-circle" size={60} color="rgba(255, 255, 255, 0.8)" />
            </View>
          </View>
        );
      case 'link':
        return <LinkPreview url={post.content} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={onProfilePress}>
          {post.userProfileImageURL ? (
            <FastImage
              source={{ uri: post.userProfileImageURL }}
              style={styles.profileImage}
              defaultSource={require('../assets/default-avatar.png')}
            />
          ) : (
            <View style={[styles.profileImage, styles.placeholderProfile]}>
              <Icon name="person" size={20} color="#FFF" />
            </View>
          )}
          <View>
            <Text style={styles.userName}>{post.userFullName}</Text>
            <Text style={styles.timestamp}>{formatTimestamp(post.timestamp)}</Text>
          </View>
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          {renderMoreOptions()}
        </View>
      </View>
      
      {post.caption && (
        <Text style={styles.caption}>{post.caption}</Text>
      )}
      
      {post.content && renderPostContent()}
      
      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Icon name="heart" size={16} color="#F44336" />
          <Text style={styles.statText}>{likeCount} likes</Text>
        </View>
        <View style={styles.stat}>
          <Icon name="chatbubble" size={16} color="#2196F3" />
          <Text style={styles.statText}>{post.commentCount || 0} comments</Text>
        </View>
      </View>
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleLikeToggle}
        >
          <Icon 
            name={isLiked ? "heart" : "heart-outline"} 
            size={24} 
            color={isLiked ? "#F44336" : "#546E7A"} 
          />
          <Text style={[
            styles.actionText,
            isLiked && { color: "#F44336" }
          ]}>
            Like
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={onCommentPress}
        >
          <Icon name="chatbubble-outline" size={24} color="#546E7A" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleSharePost}
        >
          <Icon name="share-outline" size={24} color="#546E7A" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      <BlockUserModal
        visible={blockModalVisible}
        onClose={() => setBlockModalVisible(false)}
        userToBlock={{ id: post.userId, name: post.userFullName }}
        onSuccess={handleBlockSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  placeholderProfile: {
    backgroundColor: '#90A4AE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#263238',
  },
  timestamp: {
    fontSize: 12,
    color: '#78909C',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuOptions: {
    borderRadius: 8,
    padding: 8,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  menuIcon: {
    marginRight: 10,
  },
  menuText: {
    fontSize: 16,
    color: '#455A64',
  },
  dangerText: {
    color: '#F44336',
  },
  caption: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: '#263238',
    lineHeight: 22,
  },
  postImage: {
    width: '100%',
    height: 300,
  },
  videoContainer: {
    position: 'relative',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ECEFF1',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    marginLeft: 5,
    fontSize: 13,
    color: '#546E7A',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    flex: 1,
  },
  actionText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
    color: '#546E7A',
  },
});

export default PostCard;
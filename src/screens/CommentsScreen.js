// src/screens/CommentsScreen.js
// Screen for viewing and adding comments to a post - FIXED

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import FastImage from 'react-native-fast-image';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatDistanceToNow } from 'date-fns';
import { useUser } from '../contexts/UserContext';

const CommentsScreen = ({ route, navigation }) => {
  const { postId } = route.params;
  const { userData } = useUser();
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [post, setPost] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const flatListRef = useRef();
  const inputRef = useRef();
  const isMounted = useRef(true);

  useEffect(() => {
    // Set up mounted flag for preventing state updates after unmount
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    fetchPost();
    
    // Set up real-time listener for comments
    const unsubscribe = firestore()
      .collection('comments')
      .where('postId', '==', postId)
      .orderBy('timestamp', 'asc')
      .onSnapshot(snapshot => {
        if (isMounted.current) {
          const commentsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || new Date(),
              editTimestamp: data.editTimestamp?.toDate(),
            };
          });
          
          setComments(commentsData);
          setLoading(false);
          
          // Scroll to bottom when new comments come in
          if (commentsData.length > 0 && flatListRef.current && !editingCommentId) {
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }, 200);
          }
        }
      }, error => {
        console.error('Error in comments listener:', error);
        if (isMounted.current) {
          setLoading(false);
          Alert.alert('Error', 'Failed to load comments. Please try again.');
        }
      });
      
    return () => unsubscribe();
  }, [postId]);

  const fetchPost = async () => {
    try {
      const postDoc = await firestore()
        .collection('posts')
        .doc(postId)
        .get();
      
      if (postDoc.exists && isMounted.current) {
        const data = postDoc.data();
        setPost({
          id: postDoc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
        });
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to load post details. Please try again.');
      }
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || sending) return;
    
    setSending(true);
    
    try {
      // Add comment to Firestore
      await firestore().collection('comments').add({
        postId: postId,
        userId: auth().currentUser.uid,
        userFullName: `${userData.firstName} ${userData.lastName}`,
        userProfileImageURL: userData.profileImageURL || null,
        text: commentText.trim(),
        timestamp: firestore.FieldValue.serverTimestamp(),
        edited: false
      });
      
      // Update comment count on the post
      await firestore()
        .collection('posts')
        .doc(postId)
        .update({
          commentCount: firestore.FieldValue.increment(1)
        });
      
      // Send notification to post author if it's not the current user
      if (post && post.userId !== auth().currentUser.uid) {
        await firestore().collection('notifications').add({
          type: 'comment',
          senderId: auth().currentUser.uid,
          senderName: `${userData.firstName} ${userData.lastName}`,
          senderProfileImage: userData.profileImageURL || null,
          recipientId: post.userId,
          postId: postId,
          message: 'commented on your post',
          timestamp: firestore.FieldValue.serverTimestamp(),
          read: false
        });
      }
      
      // Clear input
      setCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to add comment. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setSending(false);
      }
    }
  };

  const handleEditComment = (commentId, currentText) => {
    setEditingCommentId(commentId);
    setEditCommentText(currentText);
    
    // Focus the input with a slight delay to ensure the UI has updated
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const saveEditedComment = async () => {
    if (!editCommentText.trim() || !editingCommentId) return;
    
    setSending(true);
    
    try {
      await firestore()
        .collection('comments')
        .doc(editingCommentId)
        .update({
          text: editCommentText.trim(),
          edited: true,
          editTimestamp: firestore.FieldValue.serverTimestamp()
        });
        
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (error) {
      console.error('Error updating comment:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to update comment. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setSending(false);
      }
    }
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleDeleteComment = async (commentId) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await firestore().collection('comments').doc(commentId).delete();
              
              // Update post comment count
              await firestore()
                .collection('posts')
                .doc(postId)
                .update({
                  commentCount: firestore.FieldValue.increment(-1)
                });
            } catch (error) {
              console.error('Error deleting comment:', error);
              if (isMounted.current) {
                Alert.alert('Error', 'Failed to delete comment. Please try again.');
              }
            }
          }
        }
      ]
    );
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    return formatDistanceToNow(timestamp, { addSuffix: true });
  };

  const navigateToUserProfile = (userId) => {
    if (userId === auth().currentUser.uid) {
      navigation.navigate('ProfileTab');
    } else {
      navigation.navigate('UserProfile', { 
        userId,
        title: 'User Profile'
      });
    }
  };

  const renderCommentItem = ({ item }) => {
    const isCurrentUserComment = item.userId === auth().currentUser.uid;
    
    return (
      <View style={styles.commentItem}>
        <TouchableOpacity onPress={() => navigateToUserProfile(item.userId)}>
          {item.userProfileImageURL ? (
            <FastImage
              style={styles.profileImage}
              source={{ uri: item.userProfileImageURL }}
              resizeMode={FastImage.resizeMode.cover}
            />
          ) : (
            <View style={[styles.profileImage, styles.placeholderProfile]}>
              <Icon name="person" size={16} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
        
        <View style={styles.commentContent}>
          <View style={styles.commentBubble}>
            <View style={styles.commentHeader}>
              <TouchableOpacity onPress={() => navigateToUserProfile(item.userId)}>
                <Text style={styles.userName}>{item.userFullName}</Text>
              </TouchableOpacity>
              
              {isCurrentUserComment && (
                <View style={styles.commentActions}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleEditComment(item.id, item.text)}
                  >
                    <Icon name="pencil" size={16} color="#546E7A" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleDeleteComment(item.id)}
                  >
                    <Icon name="trash" size={16} color="#F44336" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            <Text style={styles.commentText}>{item.text}</Text>
          </View>
          
          <View style={styles.commentFooter}>
            <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
            
            {item.edited && (
              <Text style={styles.editedLabel}>
                (edited {item.editTimestamp ? formatTimestamp(item.editTimestamp) : ''})
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon name="chatbubble-outline" size={50} color="#B0BEC5" />
      <Text style={styles.emptyTitle}>No comments yet</Text>
      <Text style={styles.emptySubtitle}>Be the first to comment</Text>
    </View>
  );

  const renderPostAuthorInfo = () => {
    if (!post) return null;
    
    return (
      <View style={styles.postAuthorContainer}>
        <View style={styles.postInfoRow}>
          <Text style={styles.postInfoLabel}>Commenting on post by:</Text>
          <TouchableOpacity 
            style={styles.postAuthorInfo}
            onPress={() => navigateToUserProfile(post.userId)}
          >
            {post.userProfileImageURL ? (
              <FastImage
                style={styles.smallProfileImage}
                source={{ uri: post.userProfileImageURL }}
                resizeMode={FastImage.resizeMode.cover}
              />
            ) : (
              <View style={[styles.smallProfileImage, styles.placeholderProfile]}>
                <Icon name="person" size={12} color="#FFF" />
              </View>
            )}
            <Text style={styles.postAuthorName}>{post.userFullName}</Text>
          </TouchableOpacity>
        </View>
        
        {post.caption && (
          <Text style={styles.postCaption} numberOfLines={1}>
            "{post.caption}"
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {renderPostAuthorInfo()}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={comments}
          keyExtractor={item => item.id}
          renderItem={renderCommentItem}
          contentContainerStyle={
            comments.length === 0 ? { flex: 1 } : { paddingVertical: 16 }
          }
          ListEmptyComponent={renderEmptyComponent}
        />
      )}
      
      <View style={styles.inputContainer}>
        {editingCommentId ? (
          <View style={styles.editingContainer}>
            <Text style={styles.editingLabel}>Editing comment</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={editCommentText}
              onChangeText={setEditCommentText}
              multiline
            />
            <View style={styles.editActionButtons}>
              <TouchableOpacity 
                style={styles.cancelEditButton}
                onPress={cancelEditComment}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.saveEditButton,
                  (!editCommentText.trim() || sending) && styles.disabledButton
                ]}
                onPress={saveEditedComment}
                disabled={!editCommentText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveEditText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Write a comment..."
              placeholderTextColor="#90A4AE"
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!commentText.trim() || sending) && styles.disabledSendButton
              ]}
              onPress={handleAddComment}
              disabled={!commentText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Icon name="send" size={20} color="white" />
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAuthorContainer: {
    backgroundColor: 'white',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  postInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  postInfoLabel: {
    fontSize: 12,
    color: '#78909C',
    marginRight: 4,
  },
  postAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallProfileImage: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 4,
  },
  postAuthorName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#455A64',
  },
  postCaption: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#546E7A',
  },
  commentItem: {
    flexDirection: 'row',
    padding: 12,
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  placeholderProfile: {
    backgroundColor: '#90A4AE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentContent: {
    flex: 1,
    marginLeft: 8,
  },
  commentBubble: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontWeight: 'bold',
    color: '#263238',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 4,
    marginLeft: 8,
  },
  commentText: {
    color: '#455A64',
    fontSize: 14,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#90A4AE',
  },
  editedLabel: {
    fontSize: 12,
    color: '#90A4AE',
    fontStyle: 'italic',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#455A64',
    marginTop: 15,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#78909C',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ECEFF1',
  },
  editingContainer: {
    flex: 1,
  },
  editingLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  editActionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  cancelEditButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginRight: 8,
  },
  cancelEditText: {
    color: '#546E7A',
    fontSize: 14,
  },
  saveEditButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  saveEditText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    backgroundColor: '#F5F7F8',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    color: '#263238',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSendButton: {
    backgroundColor: '#B0BEC5',
  },
  disabledButton: {
    backgroundColor: '#B0BEC5',
  },
});

export default CommentsScreen;
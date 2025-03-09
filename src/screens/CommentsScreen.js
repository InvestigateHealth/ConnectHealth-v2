// src/screens/CommentsScreen.js
// Screen for viewing and adding comments to a post - IMPROVED

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useNetInfo } from '@react-native-community/netinfo';
import { useTheme } from '../theme/ThemeContext';

const COMMENTS_PER_PAGE = 15;

const CommentsScreen = ({ route, navigation }) => {
  const { postId, focusCommentId } = route.params;
  const { userData, blockedUsers } = useUser();
  const { theme } = useTheme();
  const { isConnected } = useNetInfo();
  
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [post, setPost] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const flatListRef = useRef();
  const inputRef = useRef();
  const isMounted = useRef(true);
  const commentsListenerRef = useRef(null);

  useEffect(() => {
    // Set up mounted flag for preventing state updates after unmount
    return () => {
      isMounted.current = false;
      if (commentsListenerRef.current) {
        commentsListenerRef.current();
      }
    };
  }, []);

  useEffect(() => {
    fetchPost();
    fetchComments(true);
    
    // Scroll to specific comment if provided
    if (focusCommentId) {
      setTimeout(() => {
        scrollToComment(focusCommentId);
      }, 1000);
    }
  }, [postId, focusCommentId]);

  // Filter comments when blockedUsers changes
  useEffect(() => {
    if (comments.length > 0) {
      setComments(prevComments => 
        prevComments.filter(comment => !blockedUsers.includes(comment.userId))
      );
    }
  }, [blockedUsers]);

  const fetchPost = async () => {
    if (!isConnected && !post) {
      Alert.alert('Offline', 'You are currently offline. Some information may be unavailable.');
    }
    
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
      } else if (isMounted.current) {
        Alert.alert('Error', 'Post not found or has been deleted.');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to load post details. Please try again.');
      }
    }
  };

  // Fetch comments with pagination
  const fetchComments = async (reset = false) => {
    if (reset && commentsListenerRef.current) {
      commentsListenerRef.current();
      commentsListenerRef.current = null;
    }

    if (reset) {
      setLoading(true);
      setRefreshing(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      let query = firestore()
        .collection('comments')
        .where('postId', '==', postId)
        .orderBy('timestamp', 'asc')
        .limit(COMMENTS_PER_PAGE);
      
      if (!reset && lastVisible) {
        query = query.startAfter(lastVisible);
      }
      
      const snapshot = await query.get();
      
      if (isMounted.current) {
        // Process the comments
        const commentsData = snapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toDate() || new Date(),
              editTimestamp: data.editTimestamp?.toDate(),
            };
          })
          .filter(comment => !blockedUsers.includes(comment.userId));
        
        // Update state
        if (reset) {
          setComments(commentsData);
        } else {
          setComments(prev => [...prev, ...commentsData]);
        }
        
        // Update pagination state
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastVisible(lastDoc);
        setHasMoreComments(snapshot.docs.length === COMMENTS_PER_PAGE);
        
        // Setup real-time listener for new comments only if this is initial load
        if (reset && commentsListenerRef.current === null) {
          setupCommentsListener();
        }
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to load comments. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  };

  // Setup real-time listener for new comments
  const setupCommentsListener = () => {
    const newCommentsQuery = firestore()
      .collection('comments')
      .where('postId', '==', postId)
      .orderBy('timestamp', 'desc')
      .limit(1);
    
    commentsListenerRef.current = newCommentsQuery.onSnapshot(snapshot => {
      if (!snapshot.empty && isMounted.current) {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const newComment = {
              id: change.doc.id,
              ...change.doc.data(),
              timestamp: change.doc.data().timestamp?.toDate() || new Date(),
              editTimestamp: change.doc.data().editTimestamp?.toDate(),
            };
            
            // Check if comment is from a blocked user
            if (!blockedUsers.includes(newComment.userId)) {
              // Check if comment already exists in our state (avoid duplicates)
              const exists = comments.some(comment => comment.id === newComment.id);
              
              if (!exists) {
                setComments(prev => [...prev, newComment]);
                
                // Scroll to bottom when new comments come in
                if (flatListRef.current && !editingCommentId) {
                  setTimeout(() => {
                    if (flatListRef.current) {
                      flatListRef.current.scrollToEnd({ animated: true });
                    }
                  }, 200);
                }
              }
            }
          }
        });
      }
    }, error => {
      console.error('Error in comments listener:', error);
    });
  };

  const scrollToComment = (commentId) => {
    const index = comments.findIndex(comment => comment.id === commentId);
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ 
        index, 
        animated: true,
        viewPosition: 0.5
      });
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || sending) return;
    
    if (!isConnected) {
      Alert.alert('Offline', 'You cannot post comments while offline.');
      return;
    }
    
    setSending(true);
    
    try {
      // Add comment to Firestore
      const commentData = {
        postId: postId,
        userId: auth().currentUser.uid,
        userFullName: `${userData.firstName} ${userData.lastName}`.trim(),
        userProfileImageURL: userData.profileImageURL || null,
        text: commentText.trim(),
        timestamp: firestore.FieldValue.serverTimestamp(),
        edited: false
      };
      
      const docRef = await firestore().collection('comments').add(commentData);
      
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
          senderName: `${userData.firstName} ${userData.lastName}`.trim(),
          senderProfileImage: userData.profileImageURL || null,
          recipientId: post.userId,
          postId: postId,
          commentId: docRef.id,
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
    if (!editCommentText.trim() || !editingCommentId || !isConnected) {
      if (!isConnected) {
        Alert.alert('Offline', 'You cannot edit comments while offline.');
      }
      return;
    }
    
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
        
      // Update comment in local state
      if (isMounted.current) {
        setComments(prevComments => 
          prevComments.map(comment => 
            comment.id === editingCommentId 
              ? { 
                  ...comment, 
                  text: editCommentText.trim(), 
                  edited: true,
                  editTimestamp: new Date()
                }
              : comment
          )
        );
      }
      
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
    if (!isConnected) {
      Alert.alert('Offline', 'You cannot delete comments while offline.');
      return;
    }
    
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
              
              // Update local state
              if (isMounted.current) {
                setComments(prevComments => 
                  prevComments.filter(comment => comment.id !== commentId)
                );
              }
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
    try {
      return formatDistanceToNow(timestamp, { addSuffix: true });
    } catch (e) {
      console.error('Error formatting timestamp:', e);
      return '';
    }
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

  const handleRefresh = useCallback(() => {
    fetchComments(true);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasMoreComments && !loadingMore && !loading) {
      fetchComments(false);
    }
  }, [hasMoreComments, loadingMore, loading]);

  const renderCommentItem = useCallback(({ item, index }) => {
    const isCurrentUserComment = item.userId === auth().currentUser.uid;
    const isHighlighted = item.id === focusCommentId;
    
    return (
      <View 
        style={[
          styles.commentItem,
          isHighlighted && { backgroundColor: theme.colors.background.highlighted }
        ]}
      >
        <TouchableOpacity onPress={() => navigateToUserProfile(item.userId)}>
          {item.userProfileImageURL ? (
            <FastImage
              style={styles.profileImage}
              source={{ uri: item.userProfileImageURL }}
              resizeMode={FastImage.resizeMode.cover}
              defaultSource={require('../assets/default-avatar.png')}
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
                <Text style={[styles.userName, { color: theme.colors.text.primary }]}>
                  {item.userFullName}
                </Text>
              </TouchableOpacity>
              
              {isCurrentUserComment && (
                <View style={styles.commentActions}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleEditComment(item.id, item.text)}
                    hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  >
                    <Icon name="pencil" size={16} color="#546E7A" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleDeleteComment(item.id)}
                    hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                  >
                    <Icon name="trash" size={16} color="#F44336" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            <Text style={[styles.commentText, { color: theme.colors.text.primary }]}>
              {item.text}
            </Text>
          </View>
          
          <View style={styles.commentFooter}>
            <Text style={[styles.timestamp, { color: theme.colors.text.secondary }]}>
              {formatTimestamp(item.timestamp)}
            </Text>
            
            {item.edited && (
              <Text style={[styles.editedLabel, { color: theme.colors.text.secondary }]}>
                (edited {item.editTimestamp ? formatTimestamp(item.editTimestamp) : ''})
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  }, [focusCommentId, theme]);

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Icon name="chatbubble-outline" size={50} color="#B0BEC5" />
      <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
        No comments yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
        Be the first to comment
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary.main} />
      </View>
    );
  };

  const renderPostAuthorInfo = () => {
    if (!post) return null;
    
    return (
      <View style={[styles.postAuthorContainer, { backgroundColor: theme.colors.background.card }]}>
        <View style={styles.postInfoRow}>
          <Text style={[styles.postInfoLabel, { color: theme.colors.text.secondary }]}>
            Commenting on post by:
          </Text>
          <TouchableOpacity 
            style={styles.postAuthorInfo}
            onPress={() => navigateToUserProfile(post.userId)}
            disabled={!post.userId}
          >
            {post.userProfileImageURL ? (
              <FastImage
                style={styles.smallProfileImage}
                source={{ uri: post.userProfileImageURL }}
                resizeMode={FastImage.resizeMode.cover}
                defaultSource={require('../assets/default-avatar.png')}
              />
            ) : (
              <View style={[
                styles.smallProfileImage, 
                styles.placeholderProfile,
                { backgroundColor: theme.colors.gray[400] }
              ]}>
                <Icon name="person" size={12} color="#FFF" />
              </View>
            )}
            <Text style={[styles.postAuthorName, { color: theme.colors.text.primary }]}>
              {post.userFullName || 'Unknown User'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {post.caption && (
          <Text 
            style={[styles.postCaption, { color: theme.colors.text.secondary }]} 
            numberOfLines={1}
          >
            "{post.caption}"
          </Text>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background.default }]}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {renderPostAuthorInfo()}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
          <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
            Loading comments...
          </Text>
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
          ListFooterComponent={renderFooter}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={11}
          onScrollToIndexFailed={info => {
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: false
                });
              }
            }, 100);
          }}
        />
      )}
      
      {!isConnected && (
        <View style={[styles.offlineWarning, { backgroundColor: theme.colors.warning.main }]}>
          <Icon name="cloud-offline" size={16} color="white" />
          <Text style={styles.offlineText}>
            You're offline. Comments can't be posted until you reconnect.
          </Text>
        </View>
      )}
      
      <View style={[
        styles.inputContainer, 
        { 
          backgroundColor: theme.colors.background.paper,
          borderTopColor: theme.colors.border 
        }
      ]}>
        {editingCommentId ? (
          <View style={styles.editingContainer}>
            <Text style={[styles.editingLabel, { color: theme.colors.primary.main }]}>
              Editing comment
            </Text>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                { 
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.background.input 
                }
              ]}
              value={editCommentText}
              onChangeText={setEditCommentText}
              multiline
              placeholder="Edit your comment..."
              placeholderTextColor={theme.colors.text.hint}
            />
            <View style={styles.editActionButtons}>
              <TouchableOpacity 
                style={styles.cancelEditButton}
                onPress={cancelEditComment}
              >
                <Text style={[styles.cancelEditText, { color: theme.colors.text.secondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.saveEditButton,
                  (!editCommentText.trim() || sending) && styles.disabledButton,
                  { backgroundColor: theme.colors.primary.main }
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
              style={[
                styles.input,
                { 
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.background.input 
                }
              ]}
              placeholder="Write a comment..."
              placeholderTextColor={theme.colors.text.hint}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={1000}
              editable={isConnected}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!commentText.trim() || sending || !isConnected) && styles.disabledSendButton,
                { backgroundColor: theme.colors.primary.main }
              ]}
              onPress={handleAddComment}
              disabled={!commentText.trim() || sending || !isConnected}
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  postAuthorContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  postInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  postInfoLabel: {
    fontSize: 12,
    marginRight: 4,
  },
  postAuthorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  },
  postCaption: {
    fontSize: 12,
    fontStyle: 'italic',
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
    fontSize: 14,
    lineHeight: 20,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 4,
  },
  timestamp: {
    fontSize: 12,
  },
  editedLabel: {
    fontSize: 12,
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
    marginTop: 15,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  editingContainer: {
    flex: 1,
  },
  editingLabel: {
    fontSize: 12,
    fontWeight: 'bold',
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
    fontSize: 14,
  },
  saveEditButton: {
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
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    fontSize: 14,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSendButton: {
    opacity: 0.5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
  offlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 6,
  }
});

export default CommentsScreen;

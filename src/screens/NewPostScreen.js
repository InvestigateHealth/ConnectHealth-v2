// src/screens/NewPostScreen.js
// Screen for creating new posts - Updated with proper Firebase integration

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useUser } from '../contexts/UserContext';
import { useTheme } from '../theme/ThemeContext';
import { PostService, UploadService } from '../services/FirebaseService';

// Constants for file limits
const MAX_IMAGE_SIZE_MB = 5;
const MAX_VIDEO_SIZE_MB = 20;
const MB_IN_BYTES = 1024 * 1024;

const NewPostScreen = ({ navigation }) => {
  const { userData } = useUser();
  const { theme } = useTheme();
  const [postType, setPostType] = useState('image'); // 'image', 'video', 'link'
  const [caption, setCaption] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [imageInfo, setImageInfo] = useState(null);
  const [videoUri, setVideoUri] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const isMounted = useRef(true);

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleImagePick = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
      includeBase64: false,
      includeExtra: true,
    };

    launchImageLibrary(options, response => {
      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        Alert.alert('Error', response.errorMessage || 'Failed to select image');
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        
        // Check file size
        if (asset.fileSize > MAX_IMAGE_SIZE_MB * MB_IN_BYTES) {
          Alert.alert('File Too Large', `Image must be smaller than ${MAX_IMAGE_SIZE_MB}MB`);
          return;
        }
        
        setImageUri(asset.uri);
        setImageInfo(asset);
      }
    });
  };

  const handleVideoPick = () => {
    const options = {
      mediaType: 'video',
      quality: 0.8,
      videoQuality: 'medium',
      durationLimit: 60, // limit to 60 seconds
      includeExtra: true,
    };

    launchImageLibrary(options, response => {
      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        Alert.alert('Error', response.errorMessage || 'Failed to select video');
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        
        // Check file size
        if (asset.fileSize > MAX_VIDEO_SIZE_MB * MB_IN_BYTES) {
          Alert.alert('File Too Large', `Video must be smaller than ${MAX_VIDEO_SIZE_MB}MB`);
          return;
        }
        
        setVideoUri(asset.uri);
        setVideoInfo(asset);
      }
    });
  };

  const isPostValid = () => {
    if (!caption.trim()) {
      return false;
    }

    if (postType === 'image' && !imageUri) {
      return false;
    }

    if (postType === 'video' && !videoUri) {
      return false;
    }

    if (postType === 'link' && !linkUrl.trim()) {
      return false;
    }

    return true;
  };

  const isValidUrl = (url) => {
    try {
      // Add protocol if missing
      let testUrl = url;
      if (!/^https?:\/\//i.test(url)) {
        testUrl = 'https://' + url;
      }
      
      new URL(testUrl);
      return true;
    } catch (e) {
      return false;
    }
  };

  const createPost = async () => {
    if (!isPostValid()) {
      Alert.alert('Validation Error', 'Please fill in all required fields for your post');
      return;
    }

    if (postType === 'link') {
      let formattedUrl = linkUrl.trim();
      
      // Add https:// if no protocol is specified
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = 'https://' + formattedUrl;
      }
      
      if (!isValidUrl(formattedUrl)) {
        Alert.alert('Invalid URL', 'Please enter a valid URL');
        return;
      }
      
      // Update the link URL with the properly formatted one
      setLinkUrl(formattedUrl);
    }

    if (isMounted.current) {
      setUploading(true);
    }

    try {
      let contentUrl = '';
      
      // Upload media if needed
      if (postType === 'image' && imageUri) {
        const filename = imageUri.substring(imageUri.lastIndexOf('/') + 1);
        const extension = filename.split('.').pop();
        const storagePath = `images/${userData.id}_${Date.now()}.${extension}`;
        
        contentUrl = await UploadService.uploadImage(
          imageUri, 
          storagePath, 
          (progress) => {
            if (isMounted.current) {
              setUploadProgress(progress);
            }
          }
        );
      } else if (postType === 'video' && videoUri) {
        const filename = videoUri.substring(videoUri.lastIndexOf('/') + 1);
        const extension = filename.split('.').pop();
        const storagePath = `videos/${userData.id}_${Date.now()}.${extension}`;
        
        contentUrl = await UploadService.uploadVideo(
          videoUri, 
          storagePath, 
          (progress) => {
            if (isMounted.current) {
              setUploadProgress(progress);
            }
          }
        );
      } else if (postType === 'link') {
        contentUrl = linkUrl;
      }
      
      if (!isMounted.current) return;
      
      // Get user data for the post
      const userFullName = userData ? 
        `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 
        'User';
      
      // Create post document in Firestore
      const postData = {
        userId: userData.id,
        userFullName,
        userProfileImageURL: userData?.profileImageURL || null,
        type: postType,
        content: contentUrl,
        caption: caption.trim()
      };
      
      await PostService.createPost(postData);
      
      if (!isMounted.current) return;
      
      // Show success message
      Alert.alert('Success', 'Your post has been created', [
        { text: 'OK', onPress: () => navigation.navigate('FeedTab') }
      ]);
      
      // Reset form
      setCaption('');
      setImageUri(null);
      setImageInfo(null);
      setVideoUri(null);
      setVideoInfo(null);
      setLinkUrl('');
      setPostType('image');
      
    } catch (error) {
      console.error('Error creating post:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to create post. Please try again later.', [
          { text: 'OK' }
        ]);
      }
    } finally {
      if (isMounted.current) {
        setUploading(false);
        setUploadProgress(0);
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background.default }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>Create Post</Text>
        </View>
        
        <View style={[styles.typeSelector, { backgroundColor: theme.colors.background.paper }]}>
          <TouchableOpacity 
            style={[
              styles.typeButton, 
              postType === 'image' && [
                styles.activeTypeButton,
                { borderBottomColor: theme.colors.primary.main }
              ]
            ]}
            onPress={() => setPostType('image')}
          >
            <Icon 
              name="image-outline" 
              size={20} 
              color={postType === 'image' ? theme.colors.primary.main : theme.colors.text.secondary} 
            />
            <Text style={[
              styles.typeText, 
              postType === 'image' && [
                styles.activeTypeText,
                { color: theme.colors.primary.main }
              ],
              { color: theme.colors.text.secondary }
            ]}>
              Image
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.typeButton, 
              postType === 'video' && [
                styles.activeTypeButton,
                { borderBottomColor: theme.colors.primary.main }
              ]
            ]}
            onPress={() => setPostType('video')}
          >
            <Icon 
              name="videocam-outline" 
              size={20} 
              color={postType === 'video' ? theme.colors.primary.main : theme.colors.text.secondary} 
            />
            <Text style={[
              styles.typeText, 
              postType === 'video' && [
                styles.activeTypeText,
                { color: theme.colors.primary.main }
              ],
              { color: theme.colors.text.secondary }
            ]}>
              Video
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.typeButton, 
              postType === 'link' && [
                styles.activeTypeButton,
                { borderBottomColor: theme.colors.primary.main }
              ]
            ]}
            onPress={() => setPostType('link')}
          >
            <Icon 
              name="link-outline" 
              size={20} 
              color={postType === 'link' ? theme.colors.primary.main : theme.colors.text.secondary} 
            />
            <Text style={[
              styles.typeText, 
              postType === 'link' && [
                styles.activeTypeText,
                { color: theme.colors.primary.main }
              ],
              { color: theme.colors.text.secondary }
            ]}>
              Link
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={[styles.inputSection, { backgroundColor: theme.colors.background.paper }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>Caption</Text>
          <TextInput
            style={[
              styles.captionInput,
              { 
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.background.input,
                borderColor: theme.colors.border
              }
            ]}
            placeholder="Write your caption..."
            placeholderTextColor={theme.colors.text.hint}
            multiline
            maxLength={500}
            value={caption}
            onChangeText={setCaption}
          />
          <Text style={[styles.characterCount, { color: theme.colors.text.secondary }]}>
            {caption.length}/500
          </Text>
        </View>
        
        <View style={[styles.inputSection, { backgroundColor: theme.colors.background.paper }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            {postType === 'image' ? 'Image' : postType === 'video' ? 'Video' : 'URL'}
          </Text>
          
          {postType === 'image' && (
            <View>
              <TouchableOpacity 
                style={[
                  styles.mediaButton,
                  { 
                    backgroundColor: theme.colors.background.input,
                    borderColor: theme.colors.border
                  }
                ]}
                onPress={handleImagePick}
              >
                <Icon name="image-outline" size={24} color={theme.colors.text.secondary} />
                <Text style={[styles.mediaButtonText, { color: theme.colors.text.primary }]}>
                  {imageUri ? 'Change Image' : 'Select Image'}
                </Text>
              </TouchableOpacity>
              
              {imageUri && (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: imageUri }} style={styles.preview} />
                  <TouchableOpacity 
                    style={styles.removePreview}
                    onPress={() => {
                      setImageUri(null);
                      setImageInfo(null);
                    }}
                  >
                    <Icon name="close-circle" size={24} color={theme.colors.error.main} />
                  </TouchableOpacity>
                </View>
              )}
              
              {imageInfo && (
                <View style={[
                  styles.fileInfoContainer,
                  { backgroundColor: theme.colors.background.default }
                ]}>
                  <Text style={[styles.fileInfoText, { color: theme.colors.text.secondary }]}>
                    Size: {(imageInfo.fileSize / MB_IN_BYTES).toFixed(2)} MB
                  </Text>
                  {imageInfo.width && imageInfo.height && (
                    <Text style={[styles.fileInfoText, { color: theme.colors.text.secondary }]}>
                      Dimensions: {imageInfo.width} x {imageInfo.height}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
          
          {postType === 'video' && (
            <View>
              <TouchableOpacity 
                style={[
                  styles.mediaButton,
                  { 
                    backgroundColor: theme.colors.background.input,
                    borderColor: theme.colors.border
                  }
                ]}
                onPress={handleVideoPick}
              >
                <Icon name="videocam-outline" size={24} color={theme.colors.text.secondary} />
                <Text style={[styles.mediaButtonText, { color: theme.colors.text.primary }]}>
                  {videoUri ? 'Change Video' : 'Select Video'}
                </Text>
              </TouchableOpacity>
              
              {videoUri && (
                <View style={[
                  styles.videoSelected,
                  { backgroundColor: theme.colors.success.lightest }
                ]}>
                  <Icon name="checkmark-circle" size={20} color={theme.colors.success.main} />
                  <Text style={[
                    styles.videoSelectedText,
                    { color: theme.colors.success.dark }
                  ]}>
                    Video selected
                  </Text>
                  <TouchableOpacity onPress={() => {
                    setVideoUri(null);
                    setVideoInfo(null);
                  }}>
                    <Icon name="close-circle" size={20} color={theme.colors.error.main} />
                  </TouchableOpacity>
                </View>
              )}
              
              {videoInfo && (
                <View style={[
                  styles.fileInfoContainer,
                  { backgroundColor: theme.colors.background.default }
                ]}>
                  <Text style={[styles.fileInfoText, { color: theme.colors.text.secondary }]}>
                    Size: {(videoInfo.fileSize / MB_IN_BYTES).toFixed(2)} MB
                  </Text>
                  {videoInfo.duration && (
                    <Text style={[styles.fileInfoText, { color: theme.colors.text.secondary }]}>
                      Duration: {Math.round(videoInfo.duration / 1000)} seconds
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
          
          {postType === 'link' && (
            <TextInput
              style={[
                styles.urlInput,
                { 
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.background.input,
                  borderColor: theme.colors.border
                }
              ]}
              placeholder="Enter URL (e.g., https://example.com)"
              placeholderTextColor={theme.colors.text.hint}
              keyboardType="url"
              autoCapitalize="none"
              value={linkUrl}
              onChangeText={setLinkUrl}
            />
          )}
        </View>
        
        <TouchableOpacity 
          style={[
            styles.submitButton, 
            !isPostValid() ? 
              { backgroundColor: theme.colors.action.disabledBackground } : 
              { backgroundColor: theme.colors.primary.main },
          ]}
          onPress={createPost}
          disabled={uploading || !isPostValid()}
        >
          {uploading ? (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.uploadingText}>
                Uploading... {Math.round(uploadProgress)}%
              </Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>Create Post</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  typeSelector: {
    flexDirection: 'row',
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeTypeButton: {
    borderBottomWidth: 2,
  },
  typeText: {
    marginLeft: 6,
    fontSize: 14,
  },
  activeTypeText: {
    fontWeight: 'bold',
  },
  inputSection: {
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  captionInput: {
    height: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
  },
  characterCount: {
    alignSelf: 'flex-end',
    marginTop: 5,
    fontSize: 12,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 5,
    padding: 12,
  },
  mediaButtonText: {
    marginLeft: 8,
    fontSize: 16,
  },
  previewContainer: {
    marginTop: 15,
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removePreview: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
  },
  videoSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    padding: 10,
    borderRadius: 5,
  },
  videoSelectedText: {
    flex: 1,
    marginLeft: 8,
  },
  fileInfoContainer: {
    marginTop: 8,
    padding: 8,
    borderRadius: 4,
  },
  fileInfoText: {
    fontSize: 12,
  },
  urlInput: {
    height: 50,
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
  },
  submitButton: {
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingText: {
    color: 'white',
    marginLeft: 8,
  },
});

export default NewPostScreen;
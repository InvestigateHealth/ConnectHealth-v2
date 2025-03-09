// src/screens/EditProfileScreen.js
// Screen for editing user profile information

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import { useUser } from '../contexts/UserContext';
import { processImage } from '../utils/mediaProcessing';

const EditProfileScreen = ({ navigation }) => {
  const { userData, updateUserData } = useUser();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [profileImageURL, setProfileImageURL] = useState(null);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  
  // Available medical conditions
  const medicalConditions = [
    "Vertigo", "Hypertension", "Hashimotos", "Arthritis", 
    "Atrial Fibrillation", "Cancer", "Multiple Sclerosis", "Crohn's Disease",
    "Fibromyalgia", "Lupus", "ADHD", "Anxiety", "Depression",
    "Diabetes", "Heart Disease", "Asthma", "COPD", "Migraine"
  ];

  // Load user data when component mounts
  useEffect(() => {
    if (userData) {
      setFirstName(userData.firstName || '');
      setLastName(userData.lastName || '');
      setGender(userData.gender || 'Prefer not to say');
      setBio(userData.bio || '');
      setProfileImageURL(userData.profileImageURL);
      setSelectedConditions(userData.medicalConditions || []);
    }
  }, [userData]);

  // Function to toggle a condition selection
  const toggleCondition = (condition) => {
    if (selectedConditions.includes(condition)) {
      setSelectedConditions(selectedConditions.filter(c => c !== condition));
    } else {
      setSelectedConditions([...selectedConditions, condition]);
    }
  };

  // Function to select profile image
  const selectProfileImage = async () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
      includeBase64: false,
    };

    try {
      const result = await launchImageLibrary(options);
      
      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        throw new Error(result.errorMessage || 'Error selecting image');
      }

      if (result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        const processedImage = await processImage(selectedImage);
        setProfileImage(processedImage);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Function to upload profile image to Firebase Storage
  const uploadProfileImage = async () => {
    if (!profileImage) return null;

    try {
      setImageUploading(true);
      
      const filename = profileImage.uri.substring(profileImage.uri.lastIndexOf('/') + 1);
      const extension = filename.split('.').pop();
      const storagePath = `profiles/${userData.id}_${Date.now()}.${extension}`;
      const reference = storage().ref(storagePath);
      
      // Delete old profile image if exists
      if (profileImageURL) {
        try {
          const oldImageRef = storage().refFromURL(profileImageURL);
          await oldImageRef.delete();
        } catch (error) {
          console.error('Error deleting old profile image:', error);
          // Continue even if deletion fails
        }
      }
      
      // Upload new image
      await reference.putFile(profileImage.uri);
      
      // Get download URL
      const url = await reference.getDownloadURL();
      setProfileImageURL(url);
      
      return url;
    } catch (error) {
      console.error('Error uploading profile image:', error);
      Alert.alert('Error', 'Failed to upload profile image. Please try again.');
      return null;
    } finally {
      setImageUploading(false);
    }
  };

  // Function to save profile changes
  const saveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing Information', 'Please enter your first and last name');
      return;
    }

    setIsLoading(true);

    try {
      // Upload profile image if changed
      let imageURL = profileImageURL;
      if (profileImage) {
        imageURL = await uploadProfileImage();
      }

      // Update user data in Firestore
      const updatedData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        bio: bio.trim(),
        medicalConditions: selectedConditions,
      };

      if (imageURL) {
        updatedData.profileImageURL = imageURL;
      }

      await updateUserData(updatedData);
      
      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>
      
      <View style={styles.imageSection}>
        <View style={styles.profileImageContainer}>
          {profileImage ? (
            <Image source={{ uri: profileImage.uri }} style={styles.profileImage} />
          ) : profileImageURL ? (
            <Image source={{ uri: profileImageURL }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.placeholderImage]}>
              <Icon name="person" size={50} color="#B0BEC5" />
            </View>
          )}
          
          {imageUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color="white" size="small" />
            </View>
          )}
        </View>
        
        <TouchableOpacity style={styles.changePhotoButton} onPress={selectProfileImage}>
          <Icon name="camera-outline" size={20} color="#2196F3" />
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter first name"
            placeholderTextColor="#90A4AE"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter last name"
            placeholderTextColor="#90A4AE"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={gender}
              onValueChange={(itemValue) => setGender(itemValue)}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label="Prefer not to say" value="Prefer not to say" />
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
              <Picker.Item label="Non-binary" value="Non-binary" />
            </Picker>
          </View>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself..."
            placeholderTextColor="#90A4AE"
            multiline
            numberOfLines={4}
            maxLength={300}
          />
          <Text style={styles.charCount}>{bio.length}/300</Text>
        </View>
      </View>
      
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Health Conditions</Text>
        <Text style={styles.sectionDescription}>
          Select the health conditions you have experience with. This helps us connect you with relevant users and content.
        </Text>
        
        <View style={styles.conditionsContainer}>
          {medicalConditions.map((condition) => (
            <TouchableOpacity
              key={condition}
              style={[
                styles.conditionTag,
                selectedConditions.includes(condition) && styles.selectedConditionTag
              ]}
              onPress={() => toggleCondition(condition)}
            >
              <Text
                style={[
                  styles.conditionText,
                  selectedConditions.includes(condition) && styles.selectedConditionText
                ]}
              >
                {condition}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveProfile}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F8',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#263238',
  },
  imageSection: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEFF1',
  },
  profileImageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    overflow: 'hidden',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderImage: {
    backgroundColor: '#ECEFF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  changePhotoText: {
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 8,
  },
  formSection: {
    margin: 16,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#263238',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#546E7A',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#546E7A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#CFD8DC',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#263238',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#78909C',
    textAlign: 'right',
    marginTop: 4,
  },
  pickerContainer: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#CFD8DC',
    borderRadius: 8,
    ...Platform.select({
      ios: {
        padding: 0,
      },
      android: {
        padding: 0,
      },
    }),
  },
  picker: {
    ...Platform.select({
      ios: {
        height: 150,
      },
      android: {
        height: 50,
      },
    }),
    width: '100%',
    color: '#263238',
  },
  pickerItem: {
    fontSize: 16,
  },
  conditionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  conditionTag: {
    backgroundColor: '#F5F7F8',
    borderWidth: 1,
    borderColor: '#CFD8DC',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    margin: 4,
  },
  selectedConditionTag: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  conditionText: {
    color: '#546E7A',
    fontSize: 14,
  },
  selectedConditionText: {
    color: '#2196F3',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ECEFF1',
    marginTop: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CFD8DC',
    backgroundColor: 'white',
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#546E7A',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EditProfileScreen;

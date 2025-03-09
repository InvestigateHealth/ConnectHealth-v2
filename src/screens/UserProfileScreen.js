// src/screens/UserProfileScreen.js
// Updated to include blocking functionality

// Import the BlockUserModal component
import BlockUserModal from '../components/BlockUserModal';

// Inside the UserProfileScreen component, add these state variables:
const [blockModalVisible, setBlockModalVisible] = useState(false);
const { isUserBlocked, blockUser, unblockUser } = useUser();
const [userIsBlocked, setUserIsBlocked] = useState(false);

// Add this useEffect to check if the user is blocked
useEffect(() => {
  if (userId) {
    setUserIsBlocked(isUserBlocked(userId));
  }
}, [userId, isUserBlocked]);

// Add this function to handle block/unblock
const handleBlockToggle = () => {
  if (userIsBlocked) {
    // Confirm unblock
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${userData?.firstName} ${userData?.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unblock', 
          onPress: async () => {
            const success = await unblockUser(userId);
            if (success) {
              setUserIsBlocked(false);
              Alert.alert('Success', `${userData?.firstName} ${userData?.lastName} has been unblocked.`);
            } else {
              Alert.alert('Error', 'Failed to unblock user. Please try again.');
            }
          }
        }
      ]
    );
  } else {
    // Show block modal
    setBlockModalVisible(true);
  }
};

// Add this function to handle successful blocking
const handleBlockSuccess = () => {
  setUserIsBlocked(true);
  Alert.alert(
    'User Blocked',
    `You have blocked ${userData?.firstName} ${userData?.lastName}.`
  );
};

// Add a moreOptions menu to the profile actions
// Modify the actionsContainer section in the return statement to include these options:

<View style={styles.actionsContainer}>
  <TouchableOpacity 
    style={[
      styles.actionButton,
      styles.followButton,
      isFollowing && styles.followingButton
    ]}
    onPress={toggleFollow}
    disabled={followLoading}
  >
    {followLoading ? (
      <ActivityIndicator 
        size="small" 
        color={isFollowing ? '#546E7A' : 'white'} 
      />
    ) : (
      <Text 
        style={[
          styles.actionButtonText,
          styles.followButtonText,
          isFollowing && styles.followingButtonText
        ]}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    )}
  </TouchableOpacity>
  
  <TouchableOpacity 
    style={styles.actionButton}
    onPress={handleShareProfile}
  >
    <Text style={styles.actionButtonText}>Share Profile</Text>
  </TouchableOpacity>
  
  {/* Add More Options Button */}
  <TouchableOpacity 
    style={styles.actionButton}
    onPress={() => {
      Alert.alert(
        'More Options',
        null,
        [
          { 
            text: userIsBlocked ? 'Unblock User' : 'Block User', 
            onPress: handleBlockToggle,
            style: userIsBlocked ? 'default' : 'destructive'
          },
          { text: 'Report User', onPress: () => {
            Alert.alert(
              'Report User',
              'Are you sure you want to report this user?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Report', 
                  style: 'destructive',
                  onPress: () => {
                    // Add report to database
                    firestore().collection('reports').add({
                      reportedUserId: userId,
                      reportedBy: auth().currentUser.uid,
                      timestamp: firestore.FieldValue.serverTimestamp(),
                      resolved: false
                    });
                    
                    Alert.alert('Report Submitted', 'Thank you for your report. We will review this user.');
                  }
                }
              ]
            );
          }},
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }}
  >
    <Text style={styles.actionButtonText}>More</Text>
  </TouchableOpacity>
</View>

// Add the BlockUserModal component to the end of the render function
<BlockUserModal
  visible={blockModalVisible}
  onClose={() => setBlockModalVisible(false)}
  userToBlock={userData}
  onSuccess={handleBlockSuccess}
/>

// -----------------------------------------------------
// src/navigation/MainTabNavigator.js
// Add BlockedUsersScreen to the ProfileStack

// Import the BlockedUsersScreen
import BlockedUsersScreen from '../screens/BlockedUsersScreen';

// Add BlockedUsersScreen to the ProfileStack
const ProfileStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="Profile" 
      component={ProfileScreen} 
      options={{ title: 'My Profile' }}
    />
    <Stack.Screen 
      name="Comments" 
      component={CommentsScreen} 
      options={({ route }) => ({ 
        title: route.params?.title || 'Comments' 
      })}
    />
    <Stack.Screen 
      name="BlockedUsers" 
      component={BlockedUsersScreen} 
      options={{ title: 'Blocked Users' }}
    />
  </Stack.Navigator>
);

// -----------------------------------------------------
// src/screens/ProfileScreen.js
// Add a link to BlockedUsersScreen in the About tab

// In the aboutContainer View, add a link to the BlockedUsers screen:
<View style={styles.aboutContainer}>
  {/* Existing info rows here */}
  
  {/* Add this section for privacy & safety */}
  <Text style={styles.sectionTitle}>Privacy & Safety</Text>
  
  <TouchableOpacity 
    style={styles.infoRow}
    onPress={() => navigation.navigate('BlockedUsers')}
  >
    <Icon name="shield-outline" size={20} color="#546E7A" />
    <Text style={styles.infoText}>Blocked Users</Text>
    <Icon name="chevron-forward" size={20} color="#CFD8DC" style={styles.rowIcon} />
  </TouchableOpacity>
  
  {/* Existing logout button here */}
</View>

// Add this style:
sectionTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  color: '#263238',
  marginTop: 20,
  marginBottom: 10,
},
rowIcon: {
  marginLeft: 'auto',
},

// -----------------------------------------------------
// Updates to Feed and other screens to filter blocked users

// src/screens/FeedScreen.js
// Update the fetchPosts function to filter out blocked users

const fetchPosts = async () => {
  if (!user || !isMounted.current) return;

  try {
    setLoading(true);

    // Get blocked users to filter them out
    const { blockedUsers } = useUser();
    
    // First get current user's connections
    const connectionsSnapshot = await firestore()
      .collection('connections')
      .where('userId', '==', user.uid)
      .get();

    // Extract connected user IDs
    const connectedUserIds = connectionsSnapshot.docs
      .map(doc => doc.data().connectedUserId)
      // Filter out blocked users
      .filter(id => !blockedUsers.includes(id));
    
    // Add current user's ID to include their own posts
    const allUserIds = [...connectedUserIds, user.uid];

    // Rest of the function remains the same
    // ...
  } catch (error) {
    // Error handling
  }
};

// src/screens/ExploreScreen.js
// Update fetchRecommendedUsers to filter out blocked users

const fetchRecommendedUsers = async () => {
  if (!userData || !userData.medicalConditions || userData.medicalConditions.length === 0) {
    setLoading(false);
    return;
  }

  setLoading(true);

  try {
    // Get blocked users
    const { blockedUsers } = useUser();
    
    // Find users who share any of the current user's medical conditions
    const usersSnapshot = await firestore()
      .collection('users')
      .where('medicalConditions', 'array-contains-any', userData.medicalConditions)
      .limit(50)
      .get();

    let users = usersSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(user => user.id !== auth().currentUser.uid) // Filter out current user
      .filter(user => !blockedUsers.includes(user.id)); // Filter out blocked users

    // Sort by number of shared conditions (descending)
    // ...
  } catch (error) {
    // Error handling
  }
};

// src/screens/CommentsScreen.js
// Filter out comments from blocked users

useEffect(() => {
  fetchPost();
  
  // Get blocked users
  const { blockedUsers } = useUser();
  
  // Set up real-time listener for comments
  const unsubscribe = firestore()
    .collection('comments')
    .where('postId', '==', postId)
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      if (isMounted.current) {
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
          // Filter out comments from blocked users
          .filter(comment => !blockedUsers.includes(comment.userId));
        
        setComments(commentsData);
        setLoading(false);
        
        // Scroll to bottom when new comments come in
        // ...
      }
    }, error => {
      // Error handling
    });
    
  return () => unsubscribe();
}, [postId, useUser().blockedUsers]); // Add blockedUsers to dependencies

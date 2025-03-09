// src/screens/AdminModerationScreen.js
// Screen for admin moderation of reported content

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { ContentModerationService } from '../services/ContentModerationService';
import FastImage from 'react-native-fast-image';
import { format } from 'date-fns';

const AdminModerationScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useUser();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'resolved', 'all'
  const [selectedReport, setSelectedReport] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'post', 'comment', 'user'
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Check if current user is an admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;
      
      try {
        const userDoc = await firestore().collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        
        if (userData && userData.role === 'admin') {
          setIsAdmin(true);
          fetchReports();
        } else {
          // Not an admin, redirect back
          Alert.alert(
            'Unauthorized Access',
            'You do not have admin privileges to access this section.',
            [
              { 
                text: 'OK', 
                onPress: () => navigation.goBack() 
              }
            ]
          );
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        Alert.alert('Error', 'Failed to verify admin privileges');
        navigation.goBack();
      }
    };
    
    checkAdminStatus();
  }, [user, navigation]);

  // Fetch reports based on active tab
  const fetchReports = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      let query = firestore().collection('reports');
      
      // Apply status filter
      if (activeTab === 'pending') {
        query = query.where('status', '==', 'pending');
      } else if (activeTab === 'resolved') {
        query = query.where('reviewed', '==', true);
      }
      
      // Apply content type filter
      if (filterType !== 'all') {
        query = query.where('type', '==', filterType);
      }
      
      // Order by timestamp descending
      query = query.orderBy('timestamp', 'desc');
      
      // Get reports
      const snapshot = await query.get();
      
      // Map reports data
      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
        reviewTimestamp: doc.data().reviewTimestamp?.toDate() || null
      }));
      
      setReports(reportsData);
    } catch (error) {
      console.error('Error fetching reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Effect to fetch reports when tab or filter changes
  useEffect(() => {
    if (isAdmin) {
      fetchReports();
    }
  }, [activeTab, filterType, isAdmin]);

  // Handle report selection
  const handleReportPress = (report) => {
    setSelectedReport(report);
    setIsModalVisible(true);
    setActionNotes('');
  };

  // Close report details modal
  const closeModal = () => {
    setIsModalVisible(false);
    setSelectedReport(null);
    setActionNotes('');
  };

  // Handle moderation action
  const handleModerationAction = async (action) => {
    if (!selectedReport) return;
    
    try {
      setIsActionLoading(true);
      
      await ContentModerationService.moderateContent(selectedReport.id, {
        decision: action,
        moderatorId: user.uid,
        notes: actionNotes,
        reason: action === 'remove' ? 'Violation of community guidelines' : 'No action needed'
      });
      
      // Close modal
      setIsModalVisible(false);
      setSelectedReport(null);
      
      // Refresh reports
      fetchReports();
      
      // Show success message
      Alert.alert(
        'Action Completed',
        `Report has been marked as ${action}.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error performing moderation action:', error);
      Alert.alert('Error', 'Failed to complete moderation action');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle viewing reported content
  const handleViewContent = () => {
    if (!selectedReport) return;
    
    // Navigate to the appropriate screen based on report type
    switch (selectedReport.type) {
      case 'post':
        navigation.navigate('PostDetail', { 
          postId: selectedReport.contentId,
          title: 'Reported Post' 
        });
        break;
      case 'comment':
        navigation.navigate('Comments', { 
          postId: selectedReport.postId,
          focusCommentId: selectedReport.contentId,
          title: 'Reported Comment' 
        });
        break;
      case 'user':
        navigation.navigate('UserProfile', { 
          userId: selectedReport.contentId,
          title: 'Reported User' 
        });
        break;
      default:
        Alert.alert('Error', 'Unknown content type');
        break;
    }
  };

  // Format timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return format(timestamp, 'MMM d, yyyy h:mm a');
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return {
          bg: theme.colors.warning.lightest,
          text: theme.colors.warning.dark
        };
      case 'remove':
        return {
          bg: theme.colors.error.lightest,
          text: theme.colors.error.dark
        };
      case 'warn':
        return {
          bg: theme.colors.warning.lightest,
          text: theme.colors.warning.dark
        };
      case 'ignore':
        return {
          bg: theme.colors.success.lightest,
          text: theme.colors.success.dark
        };
      default:
        return {
          bg: theme.colors.gray[200],
          text: theme.colors.text.secondary
        };
    }
  };

  // Get icon for report type
  const getReportTypeIcon = (type) => {
    switch (type) {
      case 'post':
        return 'document-text-outline';
      case 'comment':
        return 'chatbubble-outline';
      case 'user':
        return 'person-outline';
      default:
        return 'alert-circle-outline';
    }
  };

  // Render report item
  const renderReportItem = ({ item }) => {
    const statusStyle = getStatusColor(item.status);
    
    return (
      <TouchableOpacity
        style={[
          styles.reportItem,
          { backgroundColor: theme.colors.background.card }
        ]}
        onPress={() => handleReportPress(item)}
      >
        <View style={styles.reportHeader}>
          <View style={styles.typeContainer}>
            <View style={[
              styles.typeIconContainer,
              { backgroundColor: `${theme.colors.primary.main}20` }
            ]}>
              <Icon 
                name={getReportTypeIcon(item.type)} 
                size={18} 
                color={theme.colors.primary.main} 
              />
            </View>
            <Text style={[
              styles.reportType,
              { color: theme.colors.text.primary }
            ]}>
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Text>
          </View>
          
          <View style={[
            styles.statusBadge,
            { backgroundColor: statusStyle.bg }
          ]}>
            <Text style={[
              styles.statusText,
              { color: statusStyle.text }
            ]}>
              {item.status}
            </Text>
          </View>
        </View>
        
        <View style={styles.reportContent}>
          <Text style={[
            styles.reportReason,
            { color: theme.colors.text.primary }
          ]}>
            Reason: {item.reason}
          </Text>
          
          {item.additionalInfo ? (
            <Text style={[
              styles.reportDetails,
              { color: theme.colors.text.secondary }
            ]} numberOfLines={2}>
              Details: {item.additionalInfo}
            </Text>
          ) : null}
          
          <Text style={[
            styles.reportTimestamp,
            { color: theme.colors.text.hint }
          ]}>
            Reported: {formatDate(item.timestamp)}
          </Text>
          
          {item.reviewed && (
            <View style={styles.reviewInfo}>
              <Text style={[
                styles.reviewedText,
                { color: theme.colors.text.hint }
              ]}>
                Reviewed: {formatDate(item.reviewTimestamp)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render content filter buttons
  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterButtonsContainer}
      >
        <TouchableOpacity
          style={[
            styles.filterButton,
            filterType === 'all' && [
              styles.activeFilterButton,
              { backgroundColor: theme.colors.primary.light }
            ]
          ]}
          onPress={() => setFilterType('all')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filterType === 'all' && [
                styles.activeFilterButtonText,
                { color: theme.colors.primary.dark }
              ],
              { color: theme.colors.text.secondary }
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterButton,
            filterType === 'post' && [
              styles.activeFilterButton,
              { backgroundColor: theme.colors.primary.light }
            ]
          ]}
          onPress={() => setFilterType('post')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filterType === 'post' && [
                styles.activeFilterButtonText,
                { color: theme.colors.primary.dark }
              ],
              { color: theme.colors.text.secondary }
            ]}
          >
            Posts
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterButton,
            filterType === 'comment' && [
              styles.activeFilterButton,
              { backgroundColor: theme.colors.primary.light }
            ]
          ]}
          onPress={() => setFilterType('comment')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filterType === 'comment' && [
                styles.activeFilterButtonText,
                { color: theme.colors.primary.dark }
              ],
              { color: theme.colors.text.secondary }
            ]}
          >
            Comments
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterButton,
            filterType === 'user' && [
              styles.activeFilterButton,
              { backgroundColor: theme.colors.primary.light }
            ]
          ]}
          onPress={() => setFilterType('user')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filterType === 'user' && [
                styles.activeFilterButtonText,
                { color: theme.colors.primary.dark }
              ],
              { color: theme.colors.text.secondary }
            ]}
          >
            Users
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // Render tabs
  const renderTabs = () => (
    <View style={[styles.tabContainer, { backgroundColor: theme.colors.background.paper }]}>
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'pending' && [
            styles.activeTab,
            { borderBottomColor: theme.colors.primary.main }
          ]
        ]}
        onPress={() => handleTabChange('pending')}
      >
        <Icon
          name="time-outline"
          size={20}
          color={activeTab === 'pending' 
            ? theme.colors.primary.main 
            : theme.colors.text.secondary}
        />
        <Text
          style={[
            styles.tabText,
            activeTab === 'pending' && [
              styles.activeTabText,
              { color: theme.colors.primary.main }
            ],
            { color: theme.colors.text.secondary }
          ]}
        >
          Pending
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'resolved' && [
            styles.activeTab,
            { borderBottomColor: theme.colors.primary.main }
          ]
        ]}
        onPress={() => handleTabChange('resolved')}
      >
        <Icon
          name="checkmark-circle-outline"
          size={20}
          color={activeTab === 'resolved' 
            ? theme.colors.primary.main 
            : theme.colors.text.secondary}
        />
        <Text
          style={[
            styles.tabText,
            activeTab === 'resolved' && [
              styles.activeTabText,
              { color: theme.colors.primary.main }
            ],
            { color: theme.colors.text.secondary }
          ]}
        >
          Resolved
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.tab,
          activeTab === 'all' && [
            styles.activeTab,
            { borderBottomColor: theme.colors.primary.main }
          ]
        ]}
        onPress={() => handleTabChange('all')}
      >
        <Icon
          name="list-outline"
          size={20}
          color={activeTab === 'all' 
            ? theme.colors.primary.main 
            : theme.colors.text.secondary}
        />
        <Text
          style={[
            styles.tabText,
            activeTab === 'all' && [
              styles.activeTabText,
              { color: theme.colors.primary.main }
            ],
            { color: theme.colors.text.secondary }
          ]}
        >
          All
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render report detail modal
  const renderReportDetailModal = () => (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="slide"
      onRequestClose={closeModal}
    >
      <View style={styles.modalContainer}>
        <View style={[
          styles.modalContent,
          { backgroundColor: theme.colors.background.paper }
        ]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeModal}
            >
              <Icon name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <Text style={[
              styles.modalTitle,
              { color: theme.colors.text.primary }
            ]}>
              Report Details
            </Text>
          </View>
          
          {selectedReport && (
            <ScrollView style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={[
                  styles.detailLabel,
                  { color: theme.colors.text.secondary }
                ]}>
                  Type:
                </Text>
                <Text style={[
                  styles.detailValue,
                  { color: theme.colors.text.primary }
                ]}>
                  {selectedReport.type.charAt(0).toUpperCase() + selectedReport.type.slice(1)}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[
                  styles.detailLabel,
                  { color: theme.colors.text.secondary }
                ]}>
                  Status:
                </Text>
                <View style={[
                  styles.statusBadgeSmall,
                  { backgroundColor: getStatusColor(selectedReport.status).bg }
                ]}>
                  <Text style={[
                    styles.statusTextSmall,
                    { color: getStatusColor(selectedReport.status).text }
                  ]}>
                    {selectedReport.status}
                  </Text>
                </View>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={[
                  styles.detailLabel,
                  { color: theme.colors.text.secondary }
                ]}>
                  Reason:
                </Text>
                <Text style={[
                  styles.detailValue,
                  { color: theme.colors.text.primary }
                ]}>
                  {selectedReport.reason}
                </Text>
              </View>
              
              {selectedReport.additionalInfo && (
                <View style={styles.detailBox}>
                  <Text style={[
                    styles.detailLabel,
                    { color: theme.colors.text.secondary }
                  ]}>
                    Additional Information:
                  </Text>
                  <Text style={[
                    styles.detailText,
                    { 
                      color: theme.colors.text.primary,
                      backgroundColor: theme.colors.background.default
                    }
                  ]}>
                    {selectedReport.additionalInfo}
                  </Text>
                </View>
              )}
              
              <View style={styles.detailRow}>
                <Text style={[
                  styles.detailLabel,
                  { color: theme.colors.text.secondary }
                ]}>
                  Reported On:
                </Text>
                <Text style={[
                  styles.detailValue,
                  { color: theme.colors.text.primary }
                ]}>
                  {formatDate(selectedReport.timestamp)}
                </Text>
              </View>
              
              {selectedReport.reviewed && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={[
                      styles.detailLabel,
                      { color: theme.colors.text.secondary }
                    ]}>
                      Reviewed On:
                    </Text>
                    <Text style={[
                      styles.detailValue,
                      { color: theme.colors.text.primary }
                    ]}>
                      {formatDate(selectedReport.reviewTimestamp)}
                    </Text>
                  </View>
                  
                  {selectedReport.moderatorNotes && (
                    <View style={styles.detailBox}>
                      <Text style={[
                        styles.detailLabel,
                        { color: theme.colors.text.secondary }
                      ]}>
                        Moderator Notes:
                      </Text>
                      <Text style={[
                        styles.detailText,
                        { 
                          color: theme.colors.text.primary,
                          backgroundColor: theme.colors.background.default
                        }
                      ]}>
                        {selectedReport.moderatorNotes}
                      </Text>
                    </View>
                  )}
                </>
              )}
              
              {!selectedReport.reviewed && (
                <View style={styles.actionSection}>
                  <Text style={[
                    styles.actionTitle,
                    { color: theme.colors.text.primary }
                  ]}>
                    Take Action
                  </Text>
                  
                  <TextInput
                    style={[
                      styles.notesInput,
                      { 
                        color: theme.colors.text.primary,
                        backgroundColor: theme.colors.background.default,
                        borderColor: theme.colors.divider
                      }
                    ]}
                    placeholder="Add notes (optional)"
                    placeholderTextColor={theme.colors.text.hint}
                    multiline
                    value={actionNotes}
                    onChangeText={setActionNotes}
                  />
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        { backgroundColor: theme.colors.error.main }
                      ]}
                      onPress={() => handleModerationAction('remove')}
                      disabled={isActionLoading}
                    >
                      {isActionLoading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <>
                          <Icon name="trash-outline" size={16} color="white" />
                          <Text style={styles.actionButtonText}>Remove</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        { backgroundColor: theme.colors.warning.main }
                      ]}
                      onPress={() => handleModerationAction('warn')}
                      disabled={isActionLoading}
                    >
                      {isActionLoading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <>
                          <Icon name="alert-circle-outline" size={16} color="white" />
                          <Text style={styles.actionButtonText}>Warn</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        { backgroundColor: theme.colors.success.main }
                      ]}
                      onPress={() => handleModerationAction('ignore')}
                      disabled={isActionLoading}
                    >
                      {isActionLoading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <>
                          <Icon name="checkmark-circle-outline" size={16} color="white" />
                          <Text style={styles.actionButtonText}>Ignore</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              <TouchableOpacity
                style={[
                  styles.viewContentButton,
                  { backgroundColor: theme.colors.primary.main }
                ]}
                onPress={handleViewContent}
              >
                <Icon name="eye-outline" size={18} color="white" />
                <Text style={styles.viewContentText}>View Reported Content</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon 
        name="checkmark-done-circle-outline" 
        size={80} 
        color={theme.colors.gray[300]} 
      />
      <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
        {activeTab === 'pending' 
          ? 'No Pending Reports' 
          : activeTab === 'resolved' 
            ? 'No Resolved Reports' 
            : 'No Reports Found'}
      </Text>
      <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
        {activeTab === 'pending'
          ? 'All reported content has been reviewed'
          : activeTab === 'resolved'
            ? 'No reports have been resolved yet'
            : 'No reports match your current filters'}
      </Text>
    </View>
  );

  if (!isAdmin) {
    return (
      <View style={[
        styles.container, 
        { 
          backgroundColor: theme.colors.background.default,
          justifyContent: 'center',
          alignItems: 'center'
        }
      ]}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Text style={[
          styles.loadingText,
          { color: theme.colors.text.primary, marginTop: 20 }
        ]}>
          Verifying admin status...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.default }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.background.paper }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          Content Moderation
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.colors.text.secondary }]}>
          Review and take action on reported content
        </Text>
      </View>
      
      {renderTabs()}
      {renderFilterButtons()}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary.main} />
        </View>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReportItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            reports.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
          }
          ListEmptyComponent={renderEmptyState()}
          refreshing={loading}
          onRefresh={fetchReports}
        />
      )}
      
      {renderReportDetailModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    marginLeft: 8,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: 'bold',
  },
  filterContainer: {
    padding: 12,
  },
  filterButtonsContainer: {
    paddingVertical: 4,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  activeFilterButton: {
    borderWidth: 0,
  },
  filterButtonText: {
    fontSize: 14,
  },
  activeFilterButtonText: {
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  reportItem: {
    margin: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  reportType: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  reportContent: {
    padding: 12,
  },
  reportReason: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  reportDetails: {
    fontSize: 14,
    marginBottom: 4,
  },
  reportTimestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  reviewInfo: {
    marginTop: 4,
    padding: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 4,
  },
  reviewedText: {
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 12,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  modalBody: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '500',
    width: 120,
  },
  detailValue: {
    fontSize: 15,
    flex: 1,
  },
  detailBox: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 15,
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    lineHeight: 22,
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextSmall: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionSection: {
    marginTop: 16,
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 15,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
  },
  viewContentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  viewContentText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  }
});

export default AdminModerationScreen;
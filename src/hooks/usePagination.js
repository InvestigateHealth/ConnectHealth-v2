// src/hooks/usePagination.js
// Custom hook for handling pagination with Firestore

import { useState, useEffect, useCallback } from 'react';
import firestore from '@react-native-firebase/firestore';

/**
 * Custom hook for Firestore pagination
 * 
 * @param {Object} options - Pagination options
 * @returns {Object} Pagination state and functions
 */
export const usePagination = ({
  collection,
  where = [],
  orderBy = { field: 'timestamp', direction: 'desc' },
  limit = 10,
  dependencies = [],
  transformData = null
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Default transform function
  const defaultTransform = (doc) => ({
    id: doc.id,
    ...doc.data(),
    // Convert Firestore timestamps to JS Date objects
    ...(doc.data().timestamp && {
      timestamp: doc.data().timestamp.toDate()
    })
  });

  // Use provided transform function or default
  const transformItems = transformData || defaultTransform;

  // Initial fetch
  useEffect(() => {
    fetchInitialData();
  }, [...dependencies]);

  // Reset data when dependencies change
  useEffect(() => {
    if (!initialLoad) {
      setData([]);
      setLastDoc(null);
      setHasMore(true);
      fetchInitialData();
    }
  }, [...dependencies]);

  /**
   * Fetch initial batch of data
   */
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let query = firestore().collection(collection);
      
      // Apply where clauses
      where.forEach(condition => {
        if (condition && condition.length === 3) {
          query = query.where(condition[0], condition[1], condition[2]);
        }
      });
      
      // Apply ordering
      if (orderBy && orderBy.field) {
        query = query.orderBy(orderBy.field, orderBy.direction || 'desc');
      }
      
      // Apply limit
      query = query.limit(limit);
      
      const snapshot = await query.get();
      
      const docs = snapshot.docs.map(transformItems);
      
      setData(docs);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === limit);
      setInitialLoad(false);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Fetch more data (next page)
   */
  const fetchMoreData = async () => {
    // Don't fetch if already loading, refreshing, or no more data
    if (loading || refreshing || !hasMore || !lastDoc) return;
    
    try {
      setLoading(true);
      
      let query = firestore().collection(collection);
      
      // Apply where clauses
      where.forEach(condition => {
        if (condition && condition.length === 3) {
          query = query.where(condition[0], condition[1], condition[2]);
        }
      });
      
      // Apply ordering
      if (orderBy && orderBy.field) {
        query = query.orderBy(orderBy.field, orderBy.direction || 'desc');
      }
      
      // Apply cursor (startAfter)
      query = query.startAfter(lastDoc);
      
      // Apply limit
      query = query.limit(limit);
      
      const snapshot = await query.get();
      
      // Check if no more documents
      if (snapshot.empty) {
        setHasMore(false);
        setLoading(false);
        return;
      }
      
      const docs = snapshot.docs.map(transformItems);
      
      setData(prevData => [...prevData, ...docs]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === limit);
    } catch (err) {
      console.error('Error fetching more data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh data from the beginning
   */
  const refreshData = useCallback(() => {
    setRefreshing(true);
    setData([]);
    setLastDoc(null);
    setHasMore(true);
    fetchInitialData();
  }, [collection, where, orderBy, limit]);

  /**
   * Add item to the beginning of the list
   */
  const addItem = useCallback((item) => {
    setData(prevData => [item, ...prevData]);
  }, []);

  /**
   * Update item in the list
   */
  const updateItem = useCallback((id, updates) => {
    setData(prevData => 
      prevData.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    );
  }, []);

  /**
   * Remove item from the list
   */
  const removeItem = useCallback((id) => {
    setData(prevData => prevData.filter(item => item.id !== id));
  }, []);

  return {
    data,
    loading,
    error,
    hasMore,
    refreshing,
    fetchMoreData,
    refreshData,
    addItem,
    updateItem,
    removeItem
  };
};

export default usePagination;

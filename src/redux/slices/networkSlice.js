// src/redux/slices/networkSlice.js
// Network state management for Redux

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isOffline: false,
  connectionInfo: null,
  lastUpdated: null,
  offlineQueueLength: 0
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setOfflineStatus: (state, action) => {
      const { isOffline, connectionInfo } = action.payload;
      state.isOffline = isOffline;
      state.connectionInfo = connectionInfo;
      state.lastUpdated = new Date().toISOString();
    },
    setOfflineQueueLength: (state, action) => {
      state.offlineQueueLength = action.payload;
    },
    resetNetworkState: (state) => {
      state.isOffline = initialState.isOffline;
      state.connectionInfo = initialState.connectionInfo;
      state.lastUpdated = new Date().toISOString();
      state.offlineQueueLength = initialState.offlineQueueLength;
    }
  }
});

export const { setOfflineStatus, setOfflineQueueLength, resetNetworkState } = networkSlice.actions;

// Selectors
export const selectIsOffline = (state) => state.network.isOffline;
export const selectConnectionInfo = (state) => state.network.connectionInfo;
export const selectOfflineQueueLength = (state) => state.network.offlineQueueLength;

// Thunks
export const syncOfflineQueue = () => async (dispatch, getState) => {
  const { OfflineQueue } = await import('../../services/OfflineService');
  if (await OfflineQueue.forceSyncQueues()) {
    dispatch(setOfflineQueueLength(0));
    return true;
  }
  return false;
};

export const updateOfflineQueueCount = () => async (dispatch) => {
  const { OfflineQueue } = await import('../../services/OfflineService');
  const counts = await OfflineQueue.getPendingOperationCounts();
  
  // Sum all counts
  const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
  dispatch(setOfflineQueueLength(totalCount));
};

export default networkSlice.reducer;

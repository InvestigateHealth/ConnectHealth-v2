// src/redux/store.js
// Redux store configuration

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import thunk from 'redux-thunk';
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2';

// Import reducers
import authReducer from './slices/authSlice';
import postsReducer from './slices/postsSlice';
import userReducer from './slices/userSlice';
import notificationsReducer from './slices/notificationsSlice';
import networkReducer from './slices/networkSlice';
import themeReducer from './slices/themeSlice';

// Configure Redux Persist
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  stateReconciler: autoMergeLevel2,
  // Whitelist specific reducers to persist
  whitelist: ['auth', 'user', 'theme'],
};

// Combine all reducers
const rootReducer = combineReducers({
  auth: authReducer,
  posts: postsReducer,
  user: userReducer,
  notifications: notificationsReducer,
  network: networkReducer,
  theme: themeReducer,
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store with middleware
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types when checking for serializability
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        // Ignore these paths in the state when checking for serializability
        ignoredPaths: ['payload.timestamp', 'payload.createdAt'],
      },
    }).concat(thunk),
});

// Create persistor
export const persistor = persistStore(store);

// src/redux/slices/authSlice.js
// Authentication state management

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { AuthService } from '../../services/FirebaseService';

// Initial state
const initialState = {
  user: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

// Async thunks
export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const userCredential = await AuthService.signIn(email, password);
      return { user: userCredential.user };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const signUp = createAsyncThunk(
  'auth/signUp',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const userCredential = await AuthService.signUp(email, password);
      return { user: userCredential.user };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      await AuthService.signOut();
      return null;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (email, { rejectWithValue }) => {
    try {
      await AuthService.resetPassword(email);
      return { success: true };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Create slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Sign In
      .addCase(signIn.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Sign Up
      .addCase(signUp.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
      })
      .addCase(signUp.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Sign Out
      .addCase(signOut.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(signOut.fulfilled, (state) => {
        state.status = 'idle';
        state.user = null;
      })
      .addCase(signOut.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Reset Password
      .addCase(resetPassword.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.status = 'succeeded';
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { setUser, clearError } = authSlice.actions;

export default authSlice.reducer;

// src/redux/slices/userSlice.js
// User profile and settings state management

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { UserService, BlockService } from '../../services/FirebaseService';

// Initial state
const initialState = {
  profile: null,
  blockedUsers: [],
  status: 'idle',
  error: null,
};

// Async thunks
export const fetchUserProfile = createAsyncThunk(
  'user/fetchProfile',
  async (userId, { rejectWithValue }) => {
    try {
      const userData = await UserService.getUserById(userId);
      return userData;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'user/updateProfile',
  async ({ userId, data }, { rejectWithValue }) => {
    try {
      await UserService.updateProfile(userId, data);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchBlockedUsers = createAsyncThunk(
  'user/fetchBlockedUsers',
  async (userId, { rejectWithValue }) => {
    try {
      const blockedUserIds = await BlockService.getBlockedUsers(userId);
      return blockedUserIds;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const blockUser = createAsyncThunk(
  'user/blockUser',
  async ({ userId, blockedUserId, reason }, { rejectWithValue }) => {
    try {
      await BlockService.blockUser(userId, blockedUserId, reason);
      return blockedUserId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const unblockUser = createAsyncThunk(
  'user/unblockUser',
  async ({ userId, blockedUserId }, { rejectWithValue }) => {
    try {
      await BlockService.unblockUser(userId, blockedUserId);
      return blockedUserId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Create slice
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setProfile: (state, action) => {
      state.profile = action.payload;
    },
    clearUserData: (state) => {
      state.profile = null;
      state.blockedUsers = [];
      state.status = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch user profile
      .addCase(fetchUserProfile.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.profile = action.payload;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Update user profile
      .addCase(updateUserProfile.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.profile = { ...state.profile, ...action.payload };
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Fetch blocked users
      .addCase(fetchBlockedUsers.fulfilled, (state, action) => {
        state.blockedUsers = action.payload;
      })
      // Block user
      .addCase(blockUser.fulfilled, (state, action) => {
        state.blockedUsers.push(action.payload);
      })
      // Unblock user
      .addCase(unblockUser.fulfilled, (state, action) => {
        state.blockedUsers = state.blockedUsers.filter(
          (id) => id !== action.payload
        );
      });
  },
});

export const { setProfile, clearUserData } = userSlice.actions;

export default userSlice.reducer;

// src/redux/slices/postsSlice.js
// Posts state management

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { PostService, CommentService } from '../../services/FirebaseService';

// Initial state
const initialState = {
  feed: [],
  userPosts: {},  // Object with userId as key and array of posts as value
  currentPost: null,
  comments: {},   // Object with postId as key and array of comments as value
  status: 'idle',
  error: null,
  hasMore: true,
  lastDoc: null,
};

// Async thunks
export const fetchFeedPosts = createAsyncThunk(
  'posts/fetchFeed',
  async ({ userId, blockedUsers, limit, lastDoc }, { rejectWithValue }) => {
    try {
      const posts = await PostService.getFeedPosts(userId, blockedUsers, limit, lastDoc);
      return { posts, hasMore: posts.length === limit, lastDoc: posts[posts.length - 1] };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchUserPosts = createAsyncThunk(
  'posts/fetchUserPosts',
  async ({ userId, limit, lastDoc }, { rejectWithValue }) => {
    try {
      // Modified to use a Firebase query service
      const query = {
        collection: 'posts',
        where: [['userId', '==', userId]],
        orderBy: { field: 'timestamp', direction: 'desc' },
        limit,
      };
      
      if (lastDoc) {
        query.startAfter = lastDoc;
      }
      
      const postsSnapshot = await PostService.getPosts(query);
      
      return { 
        userId, 
        posts: postsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
        })),
        hasMore: postsSnapshot.docs.length === limit,
        lastDoc: postsSnapshot.docs[postsSnapshot.docs.length - 1] || null
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchPostById = createAsyncThunk(
  'posts/fetchPostById',
  async (postId, { rejectWithValue }) => {
    try {
      const post = await PostService.getPostById(postId);
      return post;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createPost = createAsyncThunk(
  'posts/createPost',
  async (postData, { rejectWithValue }) => {
    try {
      const postId = await PostService.createPost(postData);
      return { ...postData, id: postId, timestamp: new Date() };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deletePost = createAsyncThunk(
  'posts/deletePost',
  async (postId, { rejectWithValue }) => {
    try {
      await PostService.deletePost(postId);
      return postId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const toggleLike = createAsyncThunk(
  'posts/toggleLike',
  async ({ postId, userId }, { rejectWithValue }) => {
    try {
      const isLiked = await PostService.toggleLike(postId, userId);
      return { postId, userId, isLiked };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchComments = createAsyncThunk(
  'posts/fetchComments',
  async ({ postId, blockedUsers, limit, lastDoc }, { rejectWithValue }) => {
    try {
      const comments = await CommentService.getComments(postId, blockedUsers, limit, lastDoc);
      return { postId, comments, lastDoc: comments[comments.length - 1] || null };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const addComment = createAsyncThunk(
  'posts/addComment',
  async (commentData, { rejectWithValue }) => {
    try {
      const commentId = await CommentService.addComment(commentData);
      return { ...commentData, id: commentId, timestamp: new Date(), edited: false };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateComment = createAsyncThunk(
  'posts/updateComment',
  async ({ commentId, text }, { rejectWithValue }) => {
    try {
      await CommentService.updateComment(commentId, text);
      return { commentId, text, editTimestamp: new Date() };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteComment = createAsyncThunk(
  'posts/deleteComment',
  async ({ commentId, postId }, { rejectWithValue }) => {
    try {
      await CommentService.deleteComment(commentId, postId);
      return { commentId, postId };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Create slice
const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    resetFeed: (state) => {
      state.feed = [];
      state.hasMore = true;
      state.lastDoc = null;
    },
    resetCurrentPost: (state) => {
      state.currentPost = null;
    },
    resetComments: (state, action) => {
      const postId = action.payload;
      delete state.comments[postId];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch feed posts
      .addCase(fetchFeedPosts.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchFeedPosts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.feed = [...state.feed, ...action.payload.posts];
        state.hasMore = action.payload.hasMore;
        state.lastDoc = action.payload.lastDoc;
      })
      .addCase(fetchFeedPosts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Fetch user posts
      .addCase(fetchUserPosts.fulfilled, (state, action) => {
        const { userId, posts } = action.payload;
        if (!state.userPosts[userId]) {
          state.userPosts[userId] = [];
        }
        state.userPosts[userId] = [...state.userPosts[userId], ...posts];
      })
      // Fetch post by ID
      .addCase(fetchPostById.fulfilled, (state, action) => {
        state.currentPost = action.payload;
      })
      // Create post
      .addCase(createPost.fulfilled, (state, action) => {
        state.feed = [action.payload, ...state.feed];
        const userId = action.payload.userId;
        if (state.userPosts[userId]) {
          state.userPosts[userId] = [action.payload, ...state.userPosts[userId]];
        } else {
          state.userPosts[userId] = [action.payload];
        }
      })
      // Delete post
      .addCase(deletePost.fulfilled, (state, action) => {
        const postId = action.payload;
        state.feed = state.feed.filter(post => post.id !== postId);
        
        // Remove from userPosts as well
        for (const userId in state.userPosts) {
          state.userPosts[userId] = state.userPosts[userId].filter(
            post => post.id !== postId
          );
        }
        
        // Clear comments for this post
        delete state.comments[postId];
      })
      // Toggle like
      .addCase(toggleLike.fulfilled, (state, action) => {
        const { postId, userId, isLiked } = action.payload;
        
        // Update in feed
        const feedPost = state.feed.find(post => post.id === postId);
        if (feedPost) {
          if (isLiked) {
            feedPost.likes = feedPost.likes ? [...feedPost.likes, userId] : [userId];
            feedPost.likeCount = (feedPost.likeCount || 0) + 1;
          } else {
            feedPost.likes = feedPost.likes.filter(id => id !== userId);
            feedPost.likeCount = Math.max(0, (feedPost.likeCount || 1) - 1);
          }
        }
        
        // Update in userPosts
        for (const uid in state.userPosts) {
          const userPost = state.userPosts[uid].find(post => post.id === postId);
          if (userPost) {
            if (isLiked) {
              userPost.likes = userPost.likes ? [...userPost.likes, userId] : [userId];
              userPost.likeCount = (userPost.likeCount || 0) + 1;
            } else {
              userPost.likes = userPost.likes.filter(id => id !== userId);
              userPost.likeCount = Math.max(0, (userPost.likeCount || 1) - 1);
            }
          }
        }
        
        // Update currentPost if it's the same post
        if (state.currentPost && state.currentPost.id === postId) {
          if (isLiked) {
            state.currentPost.likes = state.currentPost.likes 
              ? [...state.currentPost.likes, userId] 
              : [userId];
            state.currentPost.likeCount = (state.currentPost.likeCount || 0) + 1;
          } else {
            state.currentPost.likes = state.currentPost.likes.filter(id => id !== userId);
            state.currentPost.likeCount = Math.max(0, (state.currentPost.likeCount || 1) - 1);
          }
        }
      })
      // Fetch comments
      .addCase(fetchComments.fulfilled, (state, action) => {
        const { postId, comments } = action.payload;
        if (!state.comments[postId]) {
          state.comments[postId] = [];
        }
        state.comments[postId] = [...state.comments[postId], ...comments];
      })
      // Add comment
      .addCase(addComment.fulfilled, (state, action) => {
        const { postId } = action.payload;
        if (!state.comments[postId]) {
          state.comments[postId] = [];
        }
        state.comments[postId].push(action.payload);
        
        // Update comment count in post
        const updateCommentCount = (post) => {
          if (post && post.id === postId) {
            post.commentCount = (post.commentCount || 0) + 1;
          }
        };
        
        // Update in feed
        state.feed.forEach(updateCommentCount);
        
        // Update in userPosts
        for (const userId in state.userPosts) {
          state.userPosts[userId].forEach(updateCommentCount);
        }
        
        // Update currentPost if it's the same post
        if (state.currentPost && state.currentPost.id === postId) {
          state.currentPost.commentCount = (state.currentPost.commentCount || 0) + 1;
        }
      })
      // Update comment
      .addCase(updateComment.fulfilled, (state, action) => {
        const { commentId, text, editTimestamp } = action.payload;
        
        // Update comment in all posts
        for (const postId in state.comments) {
          state.comments[postId] = state.comments[postId].map(comment => {
            if (comment.id === commentId) {
              return {
                ...comment,
                text,
                edited: true,
                editTimestamp,
              };
            }
            return comment;
          });
        }
      })
      // Delete comment
      .addCase(deleteComment.fulfilled, (state, action) => {
        const { commentId, postId } = action.payload;
        
        // Remove comment
        if (state.comments[postId]) {
          state.comments[postId] = state.comments[postId].filter(
            comment => comment.id !== commentId
          );
        }
        
        // Update comment count in post
        const updateCommentCount = (post) => {
          if (post && post.id === postId) {
            post.commentCount = Math.max(0, (post.commentCount || 1) - 1);
          }
        };
        
        // Update in feed
        state.feed.forEach(updateCommentCount);
        
        // Update in userPosts
        for (const userId in state.userPosts) {
          state.userPosts[userId].forEach(updateCommentCount);
        }
        
        // Update currentPost if it's the same post
        if (state.currentPost && state.currentPost.id === postId) {
          state.currentPost.commentCount = Math.max(0, (state.currentPost.commentCount || 1) - 1);
        }
      });
  },
});

export const { resetFeed, resetCurrentPost, resetComments } = postsSlice.actions;

export default postsSlice.reducer;

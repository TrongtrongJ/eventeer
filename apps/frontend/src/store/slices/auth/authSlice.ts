import { createSlice, createAsyncThunk, PayloadAction, Reducer } from '@reduxjs/toolkit';
import { UserDto, RegisterDto, LoginDto, AuthResponseDto } from '@event-mgmt/shared-schemas';
import type { RootState } from '../../index'

export interface AuthState {
  user: UserDto | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export const defaultInitialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: false,
  error: null,
}

function getInitialState(): AuthState {
  try {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    return {
      user: null,
      accessToken,
      refreshToken,
      isAuthenticated: !!accessToken,
      loading: false,
      error: null,
    };
  } catch (error) {
    return {
      ...defaultInitialState
    };
  }
};

const initialState: AuthState = getInitialState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthResponseDto>) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      // Sync to localStorage
      try {
        localStorage.setItem('accessToken', action.payload.accessToken);
        localStorage.setItem('refreshToken', action.payload.refreshToken);
        state.isAuthenticated = true
      } catch (error) {
        console.error('Failed to save tokens to localStorage:', error);
        state.isAuthenticated = false
      }
    },
    setUserData: (state, action: PayloadAction<UserDto>) => {
      state.user = action.payload;
    },
    clearCredentials: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      
      try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      } catch (error) {
        console.error('Failed to clear localStorage:', error);
      }
    },
    updateUser: (state, action: PayloadAction<Partial<UserDto>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
});

export const selectIsAuthenticated = (state: RootState) => 
  !!state.auth.accessToken && !!state.auth.user;

export const selectIsInitializing = (state: RootState) =>
  !!state.auth.accessToken && !state.auth.user;

export const selectCurrentUserData = (state: RootState) => 
  !!state.auth.user && state.auth.user
export const selectUserRole = (state: RootState) => 
  !!state.auth.user && state.auth.user.role || 'CUSTOMER'

export const selectUserAccessToken = (state: RootState) =>
  state.auth.accessToken

export const { 
  setCredentials, 
  setUserData,
  clearCredentials, 
  updateUser 
} = authSlice.actions;
export default authSlice.reducer as Reducer<AuthState>;
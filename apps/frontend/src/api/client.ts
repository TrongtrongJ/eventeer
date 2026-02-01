import axios from 'axios';
import { store } from '../store';
import { refreshAccessToken, clearCredentials } from '../store/slices/authSlice';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_API_URL || 'http://localhost:4000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add correlation ID to requests
apiClient.interceptors.request.use((config) => {
  const correlationId = crypto.randomUUID();
  config.headers['x-correlation-id'] = correlationId;
  
  // Add auth token
  const state = store.getState();
  const token = state.auth.accessToken;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Handle token refresh on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Don't retry on these endpoints to avoid infinite loops
    const skipRefreshUrls = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];
    const shouldSkipRefresh = skipRefreshUrls.some(url => originalRequest.url?.includes(url));
    
    if (error.response?.status === 401 && !originalRequest._retry && !shouldSkipRefresh) {
      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      const state = store.getState();
      const refreshToken = state.auth.refreshToken;
      
      if (!refreshToken) {
        isRefreshing = false;
        store.dispatch(clearCredentials());
        window.location.href = '/login';
        return Promise.reject(error);
      }
      
      try {
        console.log('Attempting to refresh token...');
        const result = await store.dispatch(refreshAccessToken(refreshToken)).unwrap();
        
        console.log('Token refreshed successfully');
        processQueue(null, result.accessToken);
        
        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${result.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        processQueue(refreshError, null);
        
        // Clear credentials and redirect to login
        store.dispatch(clearCredentials());
        window.location.href = '/login';
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // If it's a 401 on auth endpoints, clear credentials
    if (error.response?.status === 401 && shouldSkipRefresh) {
      store.dispatch(clearCredentials());
    }
    
    return Promise.reject(error);
  }
);

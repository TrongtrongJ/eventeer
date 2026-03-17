import { 
  combineReducers, 
  configureStore, 
  createListenerMiddleware, 
  isAnyOf 
} from '@reduxjs/toolkit';
import eventsReducer from './slices/events/eventsSlice';
import bookingsReducer from './slices/bookings/bookingsSlice';
import uiReducer from './slices/ui';
import authReducer from './slices/auth/authSlice';
import couponsReducer from './slices/coupons/couponsSlice';
import { apiSlice } from './slices/apiSlice';
import { setCredentials, clearCredentials } from './slices/auth/authSlice';

// Prevent token corruption edge case when user close the tab before the app has setCredentials properly
const authListener = createListenerMiddleware();

authListener.startListening({
  matcher: isAnyOf(setCredentials, clearCredentials),
  effect: (action, listenerApi) => {
    if (setCredentials.match(action)) {
      // Immediate persistence to disk
      localStorage.setItem('accessToken', action.payload.accessToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
  },
});

export const rootReducer = combineReducers({
  events: eventsReducer,
  bookings: bookingsReducer,
  coupons: couponsReducer,
  ui: uiReducer,
  auth: authReducer,
  [apiSlice.reducerPath]: apiSlice.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
    }).concat(apiSlice.middleware),
});

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

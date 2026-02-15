import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, RootState, AppDispatch } from './store';
import { getCurrentUser } from './store/slices/authSlice';
import EventsList from './pages/EventsList';
import EventDetails from './pages/EventDetails';
import Checkout from './pages/Checkout';
import BookingConfirmation from './pages/BookingConfirmation';
import CreateEvent from './pages/CreateEvent';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OAuthCallback from './pages/OAuthCallback';
import MyBookings from './pages/MyBookings';
import EventCoupons from './pages/EventCoupons';
import CreateCoupon from './pages/CreateCoupon';
import MetricsDashboard from './pages/MetricsDashboard';
import Profile from './pages/Profile';
import ToastContainer from './components/ToastContainer';
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';

function AppContent() {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (isAuthenticated && !user) {
      dispatch(getCurrentUser());
    }
  }, [isAuthenticated, user, dispatch]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          
          {/* Public Event Browsing */}
          <Route path="/" element={<EventsList />} />
          <Route path="/events/:id" element={<EventDetails />} />
          
          {/* Protected Routes - Require Authentication */}
          <Route 
            path="/checkout" 
            element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/booking/:id" 
            element={
              <ProtectedRoute>
                <BookingConfirmation />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/bookings" 
            element={
              <ProtectedRoute>
                <MyBookings />
              </ProtectedRoute>
            } 
          />
          
          {/* Protected Routes - Require ORGANIZER or ADMIN Role */}
          <Route 
            path="/create" 
            element={
              <ProtectedRoute requireRole="ORGANIZER">
                <CreateEvent />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/events/:eventId/coupons" 
            element={
              <ProtectedRoute requireRole="ORGANIZER">
                <EventCoupons />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/events/:eventId/coupons/create" 
            element={
              <ProtectedRoute requireRole="ORGANIZER">
                <CreateCoupon />
              </ProtectedRoute>
            } 
          />

          <Route
            path="/metrics"
            element={
              <ProtectedRoute requireRole="ADMIN">
                <MetricsDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </Provider>
  );
}

export default App;

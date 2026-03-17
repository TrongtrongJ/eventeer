import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, RootState, AppDispatch } from './store';
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
// import MetricsDashboard from './pages/MetricsDashboard';
import Profile from './pages/Profile';
import ToastContainer from './components/ToastContainer';
import Navigation from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './components/AuthProvider/AuthProvider';
import { useGetMeQuery } from './store/slices/auth/authApi';
import { useAppSelector } from './store/hooks';
import { selectUserAccessToken } from './store/slices/auth/authSlice';

function AppContent() {
  const dispatch = useDispatch<AppDispatch>();
  const accessToken = useAppSelector(selectUserAccessToken);

  const { isLoading, isError } = useGetMeQuery(undefined, {
    skip: !accessToken
  });

  return (

    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <AuthProvider>
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
            <Route path="/events/:eventId" element={<EventDetails />} />
            
            {/* Protected Routes - Require Authentication */}
            <Route 
              path="/checkout/:bookingId" 
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
                <ProtectedRoute requireRole={["ADMIN", "ORGANIZER"]}>
                  <CreateEvent />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/events/:eventId/coupons" 
              element={
                <ProtectedRoute requireRole={["ADMIN", "ORGANIZER"]}>
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
                  <div></div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </AuthProvider>

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

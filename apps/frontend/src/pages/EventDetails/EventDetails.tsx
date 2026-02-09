import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEventById } from '../../store/slices/eventsSlice';
import { createBooking } from '../../store/slices/bookingsSlice';
import { RootState, AppDispatch } from '../../store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { addToast } from '../../store/slices/ui';
import { CreateBookingDto } from '@event-mgmt/shared-schemas';
import { formatEventDate } from './helpers'

const EventDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { selectedEvent, loading } = useSelector((state: RootState) => state.events);
  const { loading: bookingLoading } = useSelector((state: RootState) => state.bookings);
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  useWebSocket(id);

  const [formData, setFormData] = useState({
    quantity: 1,
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    couponCode: '',
  });

  useEffect(() => {
    if (id) {
      dispatch(fetchEventById(id));
    }
  }, [id, dispatch]);

  useEffect(() => {
    // Auto-fill form with user data when authenticated
    if (user) {
      setFormData((prev) => ({
        ...prev,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      }));
    }
  }, [user]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEvent) return;

    // Check if user is authenticated
    if (!isAuthenticated) {
      dispatch(
        addToast({
          message: 'Please login to book tickets',
          type: 'error',
        })
      );
      navigate('/login', { state: { from: `/events/${id}` } });
      return;
    }

    const bookingDto: CreateBookingDto = {
      eventId: selectedEvent.id,
      quantity: formData.quantity,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      couponCode: formData.couponCode || undefined,
    };

    try {
      const result = await dispatch(createBooking(bookingDto)).unwrap();
      dispatch(addToast({ message: 'Booking created! Proceeding to payment...', type: 'success' }));
      navigate('/checkout');
    } catch (error: any) {
      dispatch(addToast({ message: error.message || 'Failed to create booking', type: 'error' }));
    }
  }, [ selectedEvent, isAuthenticated, formData, dispatch ]);

  if (loading || !selectedEvent) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // No need to use useMemo, these are already fast with low overhead
  const totalPrice = selectedEvent.ticketPrice * formData.quantity;
  const selectedEventData = formatEventDate(selectedEvent.startDate)
  const canPurchase = selectedEvent.availableSeats > 0 && isAuthenticated

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/')}
        className="mb-6 text-indigo-600 hover:text-indigo-800 flex items-center"
      >
        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Events
      </button>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {selectedEvent.imageUrl && (
          <img
            src={selectedEvent.imageUrl}
            alt={selectedEvent.title}
            className="w-full h-64 object-cover"
          />
        )}

        <div className="p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{selectedEvent.title}</h1>

          {selectedEvent.organizerName && (
            <p className="text-sm text-gray-500 mb-4">
              Organized by <span className="font-medium">{selectedEvent.organizerName}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6 text-gray-600">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {selectedEventData}
            </div>

            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
              </svg>
              {selectedEvent.location}
            </div>
          </div>

          <p className="text-gray-700 mb-6">{selectedEvent.description}</p>

          <div className="bg-indigo-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-700">Available Seats:</span>
              <span
                className={`text-2xl font-bold ${
                  selectedEvent.availableSeats > 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {selectedEvent.availableSeats} / {selectedEvent.capacity}
              </span>
            </div>
          </div>

          {!isAuthenticated && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-yellow-600 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="text-yellow-800">
                  Please{' '}
                  <button onClick={() => navigate('/login')} className="font-medium underline">
                    login
                  </button>{' '}
                  to book tickets
                </span>
              </div>
            </div>
          )}

          {canPurchase && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max={Math.min(20, selectedEvent.availableSeats)}
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coupon Code (Optional)
                </label>
                <input
                  type="text"
                  value={formData.couponCode}
                  onChange={(e) => setFormData({ ...formData, couponCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter code"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-700">Total:</span>
                  <span className="text-3xl font-bold text-indigo-600">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={bookingLoading}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg font-semibold"
              >
                {bookingLoading ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export { EventDetails };

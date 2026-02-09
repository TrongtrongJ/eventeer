import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { apiClient } from '../api/client';

const MyBookings: React.FC = () => {
  const navigate = useNavigate();
  const [ bookings, setBookings ] = React.useState<any[]>([]);
  const [ loading, setLoading ] = React.useState(true);
  const { user } = useSelector((state: RootState) => state.auth);

  const fetchMyBookings = async () => {
    try {
      const response = await apiClient.get('/bookings/my/bookings');
      setBookings(response.data.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBookings();
  }, []);

  return loading ? (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    ) : (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">My Bookings</h1>

        { bookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">You haven't made any bookings yet.</p>
            <button
              onClick={() => navigate('/')}
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
            >
              Browse Events
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            { bookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Booking #{booking.id.slice(0, 8)}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Quantity:</span> {booking.quantity} ticket(s)
                      </div>
                      <div>
                        <span className="font-medium">Total:</span> ${booking.finalAmount.toFixed(2)}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span>{' '}
                        <span
                          className={`
                          px-2 py-1 rounded text-xs font-medium
                          ${booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : ''}
                          ${booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${booking.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : ''}
                        `}
                        >
                          {booking.status}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Date:</span>{' '}
                        {new Date(booking.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/booking/${booking.id}`)}
                    className="ml-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  );
};

export default MyBookings;

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBooking } from '../store/slices/bookingsSlice';
import { RootState, AppDispatch } from '../store';
import QRCode from 'react-qr-code';

const BookingConfirmation: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { currentBooking } = useSelector((state: RootState) => state.bookings);

  useEffect(() => {
    if (id) {
      dispatch(fetchBooking(id));
    }
  }, [id, dispatch]);

  if (!currentBooking) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
          <p className="text-gray-600">Confirmation has been sent to {currentBooking.email}</p>
        </div>

        <div className="border-t border-b py-6 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Booking ID:</span>
              <p className="font-semibold">{currentBooking.id}</p>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <p className="font-semibold text-green-600">{currentBooking.status}</p>
            </div>
            <div>
              <span className="text-gray-500">Name:</span>
              <p className="font-semibold">
                {currentBooking.firstName} {currentBooking.lastName}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Tickets:</span>
              <p className="font-semibold">{currentBooking.quantity}</p>
            </div>
            <div>
              <span className="text-gray-500">Total Paid:</span>
              <p className="font-semibold text-indigo-600">
                ${currentBooking.finalAmount.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Your Tickets</h2>

          {currentBooking.tickets.map((ticket, index) => (
            <div key={ticket.id} className="border rounded-lg p-6 bg-gray-50">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Ticket #{index + 1}</h3>
                  <p className="text-sm text-gray-600">{ticket.ticketNumber}</p>
                </div>
                {ticket.isValidated && (
                  <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                    Used
                  </span>
                )}
              </div>

              <div className="flex justify-center bg-white p-4 rounded">
                <QRCode value={ticket.qrCode} size={200} />
              </div>

              <p className="text-center text-sm text-gray-500 mt-4">
                Present this QR code at the event entrance
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-md hover:bg-indigo-700 transition-colors font-semibold"
          >
            Browse More Events
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-md hover:bg-gray-300 transition-colors font-semibold"
          >
            Print Tickets
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;

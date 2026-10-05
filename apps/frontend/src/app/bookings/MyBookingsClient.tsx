'use client';

import { formatMoney } from '@/lib/format';
import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { orpc } from '@/lib/orpc/query';
import { getBookingStatusClass, formatBookingDate } from './helpers';

export function MyBookingsClient() {
  const { data, isLoading, isError, error } = useQuery(orpc.bookings.getMyBookings.queryOptions());
  const bookings = data?.data;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {(error as any)?.message || 'Something went wrong'}
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-600 mb-4">You haven't made any bookings yet.</p>
        <Link href="/" className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 inline-block">
          Browse Events
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Bookings</h1>
      <div className="space-y-4">
        {bookings.map((booking) => (
          <div key={booking.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
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
                    <span className="font-medium">Total:</span> {formatMoney(booking.finalAmount, booking.currency)}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>{' '}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getBookingStatusClass(booking.status)}`}>
                      {booking.status}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Date:</span> {formatBookingDate(booking.createdAt)}
                  </div>
                </div>
              </div>

              <Link
                href={`/booking/${booking.id}`}
                className="ml-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                View Details
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

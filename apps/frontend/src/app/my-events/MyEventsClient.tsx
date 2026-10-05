'use client';

import { formatMoney } from '@/lib/format';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { orpc } from '@/lib/orpc/query';

export function MyEventsClient() {
  const router = useRouter();
  const { data, isLoading } = useQuery(orpc.events.getMyEvents.queryOptions());
  const events = data?.data;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-600 mb-4">You haven't created any events yet.</p>
        <button
          onClick={() => router.push('/create')}
          className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
        >
          Create Your First Event
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Events</h1>
        <Link href="/create" className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700">
          + Create Event
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <div key={event.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            {event.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.imageUrl} alt={event.title} className="w-full h-48 object-cover rounded-t-lg" />
            )}

            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{event.title}</h3>
              <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>

              <div className="space-y-2 text-sm text-gray-500 mb-4">
                <div className="flex justify-between">
                  <span>Available:</span>
                  <span className="font-semibold">
                    {event.availableSeats} / {event.capacity}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Price:</span>
                  <span className="font-semibold">{formatMoney(event.ticketPrice, event.currency)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/events/${event.id}`}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-center"
                >
                  View
                </Link>
                <Link
                  href={`/events/${event.id}/coupons`}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                    />
                  </svg>
                  Coupons
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

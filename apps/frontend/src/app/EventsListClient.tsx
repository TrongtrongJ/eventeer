'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { orpc } from '@/lib/orpc/query';
import type { eventsClient } from '@/lib/orpc/browser-client';
import EmptyList from '@/components/EmptyList';

type EventsFindAllData = Awaited<ReturnType<typeof eventsClient.findAll>>;

interface EventsListClientProps {
  initialData?: EventsFindAllData;
  pageSize: number;
}

export function EventsListClient({ initialData, pageSize }: EventsListClientProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    ...orpc.events.findAll.queryOptions({
      input: { pagination: { page, limit: pageSize } },
    }),
    initialData: page === 1 ? initialData : undefined,
    placeholderData: keepPreviousData,
  });

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

  const events = data?.data ?? [];

  if (events.length === 0) {
    return <EmptyList message="No events found. Create one!" />;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Upcoming Events</h2>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isFetching ? 'opacity-60' : ''}`}>
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer block"
          >
            {event.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.imageUrl} alt={event.title} className="w-full h-48 object-cover" />
            )}
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{event.title}</h3>
              <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>

              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {new Date(event.startDate).toLocaleDateString()}
                </div>

                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {event.location}
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center">
                <span className="text-2xl font-bold text-indigo-600">${event.ticketPrice}</span>
                <span className={`text-sm ${event.availableSeats > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {event.availableSeats > 0 ? `${event.availableSeats} seats left` : 'Sold Out'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {data?.meta && (data.meta.hasPreviousPage || data.meta.hasNextPage) && (
        <div className="mt-8 flex justify-center items-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!data.meta.hasPreviousPage}
            className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {data.meta.page} of {data.meta.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!data.meta.hasNextPage}
            className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

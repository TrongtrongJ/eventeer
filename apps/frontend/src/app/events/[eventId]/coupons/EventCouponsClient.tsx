'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { orpc } from '@/lib/orpc/query';
import SpinnerLoader from '@/components/Loader/SpinnerLoader';
import EmptyList from '@/components/EmptyList';
import { EventCouponsPanel } from './EventCouponsPanel';

export function EventCouponsClient({ eventId }: { eventId: string }) {
  const { data: eventData, isLoading: isEventLoading, isError: isEventError } = useQuery(
    orpc.events.findOne.queryOptions({ input: { id: eventId } }),
  );

  const { data: couponsData } = useQuery(
    orpc.coupons.getEventCoupons.queryOptions({ input: { eventId } }),
  );

  const event = eventData?.data;
  const coupons = couponsData?.data;

  if (isEventLoading) {
    return <SpinnerLoader />;
  }

  if (isEventError || !event) {
    return <EmptyList message="Failed to find an event with specified eventId!" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/events/${eventId}`}
          className="text-indigo-600 hover:text-indigo-800 flex items-center mb-4"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Event
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Coupons</h1>
            <p className="text-gray-600">For: {event.title}</p>
          </div>

          <Link
            href={`/events/${eventId}/coupons/create`}
            className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 font-semibold"
          >
            + Create Coupon
          </Link>
        </div>
      </div>

      <EventCouponsPanel eventId={eventId} coupons={coupons} />
    </div>
  );
}

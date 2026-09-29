'use client';

import React from 'react';
import Link from 'next/link';
import type { CouponDto } from '@packages/shared-schemas';
import { EventCouponItem } from './EventCouponItem';

interface EventCouponsPanelProps {
  coupons?: CouponDto[];
  eventId: string;
}

export function EventCouponsPanel({ coupons, eventId }: EventCouponsPanelProps) {
  const isCouponsListEmpty = !coupons || coupons.length === 0;

  if (isCouponsListEmpty) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
          />
        </svg>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No coupons yet</h3>
        <p className="text-gray-600 mb-6">Create your first coupon to offer discounts to your attendees</p>
        <Link
          href={`/events/${eventId}/coupons/create`}
          className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 inline-block"
        >
          Create First Coupon
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {coupons.map((coupon) => (
        <EventCouponItem key={coupon.id} coupon={coupon} />
      ))}
    </div>
  );
}

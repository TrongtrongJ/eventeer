import React from 'react';
import { requireSession } from '@/lib/auth/require-session';
import { AccessDenied } from '@/components/AccessDenied';
import { EventCouponsClient } from './EventCouponsClient';

interface EventCouponsPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventCouponsPage({ params }: EventCouponsPageProps) {
  const { denied } = await requireSession(['ORGANIZER', 'ADMIN']);
  if (denied) return <AccessDenied />;

  const { eventId } = await params;
  return <EventCouponsClient eventId={eventId} />;
}

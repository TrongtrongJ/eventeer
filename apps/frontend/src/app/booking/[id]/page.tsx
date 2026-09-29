import React from 'react';
import { requireSession } from '@/lib/auth/require-session';
import { AccessDenied } from '@/components/AccessDenied';
import { BookingConfirmationClient } from './BookingConfirmationClient';

interface BookingConfirmationPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingConfirmationPage({ params }: BookingConfirmationPageProps) {
  const { denied } = await requireSession();
  if (denied) return <AccessDenied />;

  const { id } = await params;
  return <BookingConfirmationClient bookingId={id} />;
}

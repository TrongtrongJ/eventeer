import React from 'react';
import { requireSession } from '@/lib/auth/require-session';
import { AccessDenied } from '@/components/AccessDenied';
import { CheckoutClient } from './CheckoutClient';

interface CheckoutPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { denied } = await requireSession();
  if (denied) return <AccessDenied />;

  const { bookingId } = await params;
  return <CheckoutClient bookingId={bookingId} />;
}

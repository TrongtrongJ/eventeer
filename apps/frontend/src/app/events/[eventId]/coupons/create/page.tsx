import React from 'react';
import { requireSession } from '@/lib/auth/require-session';
import { AccessDenied } from '@/components/AccessDenied';
import { CreateCouponClient } from './CreateCouponClient';

interface CreateCouponPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function CreateCouponPage({ params }: CreateCouponPageProps) {
  const { denied } = await requireSession(['ORGANIZER', 'ADMIN']);
  if (denied) return <AccessDenied />;

  const { eventId } = await params;
  return <CreateCouponClient eventId={eventId} />;
}

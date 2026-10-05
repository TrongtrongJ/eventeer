import React from 'react';
import { requireSession } from '@/lib/auth/require-session';
import { AccessDenied } from '@/components/AccessDenied';
import { MyBookingsClient } from './MyBookingsClient';

export default async function MyBookingsPage() {
  const { denied } = await requireSession();
  if (denied) return <AccessDenied />;

  return <MyBookingsClient />;
}

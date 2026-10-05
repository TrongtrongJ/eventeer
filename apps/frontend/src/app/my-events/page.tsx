import React from 'react';
import { requireSession } from '@/lib/auth/require-session';
import { AccessDenied } from '@/components/AccessDenied';
import { MyEventsClient } from './MyEventsClient';

export default async function MyEventsPage() {
  const { denied } = await requireSession(['ORGANIZER', 'ADMIN']);
  if (denied) return <AccessDenied />;

  return <MyEventsClient />;
}

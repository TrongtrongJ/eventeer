import React from 'react';
import { requireSession } from '@/lib/auth/require-session';
import { AccessDenied } from '@/components/AccessDenied';
import { CreateEventClient } from './CreateEventClient';

export default async function CreateEventPage() {
  const { denied } = await requireSession(['ORGANIZER', 'ADMIN']);
  if (denied) return <AccessDenied />;

  return <CreateEventClient />;
}

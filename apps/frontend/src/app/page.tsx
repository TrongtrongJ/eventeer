import React from 'react';
import { createServerOrpc } from '@/lib/orpc/server-client';
import { EventsListClient } from './EventsListClient';

const PAGE_SIZE = 12;

export default async function EventsListPage() {
  const orpc = createServerOrpc();

  let initialData;
  try {
    initialData = await orpc.events.findAll({ pagination: { page: 1, limit: PAGE_SIZE } });
  } catch {
    initialData = undefined;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <EventsListClient initialData={initialData} pageSize={PAGE_SIZE} />
    </div>
  );
}

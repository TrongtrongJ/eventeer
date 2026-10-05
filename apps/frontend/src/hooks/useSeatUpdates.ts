'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { SeatAvailabilityUpdate } from '@packages/shared-schemas';
import { webSocketUrl } from '@/lib/orpc/config';

/**
 * Live seat count for one event. Subscribes to the event's room and returns the latest
 * availability pushed by the API (falling back to the server-rendered value until then).
 */
export function useSeatUpdates(eventId: string, initialSeats: number): number {
  const [availableSeats, setAvailableSeats] = useState(initialSeats);

  // A fresh server render (e.g. after router.refresh) is newer than whatever we last pushed.
  useEffect(() => setAvailableSeats(initialSeats), [initialSeats]);

  useEffect(() => {
    const socket = io(webSocketUrl, { transports: ['websocket'] });

    socket.on('connect', () => socket.emit('subscribe:event', { eventId }));
    socket.on('seat:update', (update: SeatAvailabilityUpdate) => {
      if (update.eventId === eventId) setAvailableSeats(update.availableSeats);
    });

    return () => {
      socket.emit('unsubscribe:event', { eventId });
      socket.close();
    };
  }, [eventId]);

  return availableSeats;
}

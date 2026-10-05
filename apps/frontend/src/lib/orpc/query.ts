'use client';

import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import {
  authClient,
  bookingsClient,
  couponsClient,
  eventsClient,
  ticketsClient,
} from './browser-client';

/**
 * Drop-in replacement for the old RTK Query `apiSlice.injectEndpoints` pattern.
 * Usage mirrors the oRPC + TanStack Query docs:
 *
 *   useQuery(orpc.events.findAll.queryOptions({ input: { pagination: {} } }))
 *   useMutation(orpc.bookings.createBooking.mutationOptions())
 */
export const orpc = {
  auth: createTanstackQueryUtils(authClient, { path: ['auth'] }),
  events: createTanstackQueryUtils(eventsClient, { path: ['events'] }),
  bookings: createTanstackQueryUtils(bookingsClient, { path: ['bookings'] }),
  coupons: createTanstackQueryUtils(couponsClient, { path: ['coupons'] }),
  tickets: createTanstackQueryUtils(ticketsClient, { path: ['tickets'] }),
};

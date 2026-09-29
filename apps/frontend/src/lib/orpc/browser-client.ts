'use client';

import { createORPCClient, type StandardUrl } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi/fetch';
import type { JsonifiedClient } from '@orpc/openapi';
import type { RouterContract, ContractRouterClient } from '@orpc/contract';
import {
  authContract,
  bookingContract,
  couponContract,
  eventContract,
  ticketContract,
} from '@packages/contract';
import { domainBaseUrl } from './config';

/**
 * The backend's access-token strategy reads the token exclusively from the
 * `access_token` httpOnly cookie (see apps/backend auth strategies), so the
 * browser client just needs to send credentials - no manual token handling.
 */
function browserFetch(request: Request | string, init?: RequestInit) {
  return globalThis.fetch(request, {
    ...init,
    credentials: 'include',
  });
}

function makeLink<T extends Record<any, any>>(contract: T, url: string) {
  return new OpenAPILink(contract as RouterContract, {
    url: url as StandardUrl,
    fetch: browserFetch,
  });
}

export const authClient: JsonifiedClient<ContractRouterClient<typeof authContract>> =
  createORPCClient(makeLink(authContract, domainBaseUrl.auth));

export const eventsClient: JsonifiedClient<ContractRouterClient<typeof eventContract>> =
  createORPCClient(makeLink(eventContract, domainBaseUrl.events));

export const bookingsClient: JsonifiedClient<ContractRouterClient<typeof bookingContract>> =
  createORPCClient(makeLink(bookingContract, domainBaseUrl.bookings));

export const couponsClient: JsonifiedClient<ContractRouterClient<typeof couponContract>> =
  createORPCClient(makeLink(couponContract, domainBaseUrl.coupons));

export const ticketsClient: JsonifiedClient<ContractRouterClient<typeof ticketContract>> =
  createORPCClient(makeLink(ticketContract, domainBaseUrl.tickets));

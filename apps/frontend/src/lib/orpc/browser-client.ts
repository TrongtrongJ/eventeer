'use client';

import { createORPCClient, type StandardUrl } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi/fetch';
import type { JsonifiedClient } from '@orpc/openapi';
import type { RouterContract, ContractRouterClient } from '@orpc/contract';
import { authContract, bookingContract, couponContract, eventContract, ticketContract } from '@packages/contract';
import { apiUrl, domainBaseUrl } from './config';

/** Fired when the session can no longer be renewed. Providers listens and sends the user to /login. */
export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

/**
 * Auth endpoints must never trigger a refresh-and-retry (it would loop or mask real
 * credential errors). `/auth/me` is the exception: a 401 there usually just means the
 * short-lived access cookie lapsed, which a refresh fixes.
 */
function shouldRefreshOn401(url: string): boolean {
  const path = new URL(url, apiUrl).pathname;
  return !path.startsWith('/auth/') || path === '/auth/me';
}

// Single-flight: N parallel requests that hit a 401 share ONE refresh call. Refresh tokens
// rotate on use, so firing several concurrently would be treated as replay by the server.
let inflightRefresh: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  inflightRefresh ??= globalThis
    .fetch(`${apiUrl}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      inflightRefresh = null;
    });
  return inflightRefresh;
}

/**
 * Cookie auth with silent renewal: send credentials; on a 401, refresh once and replay the
 * request. Tokens never touch JavaScript (they're httpOnly), so there is nothing to attach.
 */
async function browserFetch(request: Request | string, init?: RequestInit): Promise<Response> {
  const url = typeof request === 'string' ? request : request.url;
  // A Request body can only be consumed once, so keep a pristine copy for the retry.
  const replay = typeof request === 'string' ? request : request.clone();

  const response = await globalThis.fetch(request, { ...init, credentials: 'include' });
  if (response.status !== 401 || !shouldRefreshOn401(url)) return response;

  if (await refreshSession()) {
    return globalThis.fetch(replay, { ...init, credentials: 'include' });
  }

  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return response;
}

function makeLink<T extends Record<any, any>>(contract: T, url: string) {
  return new OpenAPILink(contract as RouterContract, { url: url as StandardUrl, fetch: browserFetch });
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

import 'server-only';

import { cookies } from 'next/headers';
import { createORPCClient, type StandardUrl } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi/fetch';
import type { JsonifiedClient } from '@orpc/openapi';
import type { ContractRouterClient } from '@orpc/contract';
import {
  authContract,
  bookingContract,
  couponContract,
  eventContract,
  ticketContract,
} from '@packages/contract';
import { domainBaseUrl } from './config';

/**
 * Server Components / Route Handlers talk to the backend directly (no browser
 * cookie jar involved), so we manually forward the incoming request's
 * `access_token` / `refresh_token` cookies as a `Cookie` header. The backend's
 * passport strategies read tokens exclusively from cookies, so this is all
 * that's required to make an authenticated server-side call.
 */
async function serverFetch(request: Request | string, init?: RequestInit) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  return globalThis.fetch(request, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  });
}

function makeServerLink<T extends object>(contract: T, url: string) {
  return new OpenAPILink(contract as any, {
    url: url as StandardUrl,
    fetch: serverFetch,
  });
}

/**
 * Creates a fresh set of server-side contract clients scoped to the current
 * request. Call this inside Server Components / Route Handlers - don't cache
 * the result at module scope, since it captures per-request cookies.
 */
export function createServerOrpc() {
  return {
    auth: createORPCClient(makeServerLink(authContract, domainBaseUrl.auth)) as JsonifiedClient<
      ContractRouterClient<typeof authContract>
    >,
    events: createORPCClient(
      makeServerLink(eventContract, domainBaseUrl.events),
    ) as JsonifiedClient<ContractRouterClient<typeof eventContract>>,
    bookings: createORPCClient(
      makeServerLink(bookingContract, domainBaseUrl.bookings),
    ) as JsonifiedClient<ContractRouterClient<typeof bookingContract>>,
    coupons: createORPCClient(
      makeServerLink(couponContract, domainBaseUrl.coupons),
    ) as JsonifiedClient<ContractRouterClient<typeof couponContract>>,
    tickets: createORPCClient(
      makeServerLink(ticketContract, domainBaseUrl.tickets),
    ) as JsonifiedClient<ContractRouterClient<typeof ticketContract>>,
  };
}

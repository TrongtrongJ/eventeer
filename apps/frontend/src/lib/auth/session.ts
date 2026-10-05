import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, type UserDto } from '@packages/shared-schemas';
import { createServerOrpc } from '../orpc/server-client';
import { canAccess } from './access-control';

export { canAccess };

export interface Session {
  isAuthenticated: boolean;
  user: UserDto | null;
}

/**
 * Reads the current user server-side by calling GET /auth/me with the
 * request's forwarded cookies. Returns a null session rather than throwing,
 * since "not logged in" is an expected, common state for public pages.
 */
export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  const hasAccessToken = cookieStore.has(AUTH_COOKIE.ACCESS);

  if (!hasAccessToken) {
    return { isAuthenticated: false, user: null };
  }

  try {
    const orpc = createServerOrpc();
    const response = await orpc.auth.me();
    return { isAuthenticated: true, user: response.data };
  } catch {
    // Expired/invalid token - treat as logged out rather than erroring the page.
    return { isAuthenticated: false, user: null };
  }
}

/**
 * What the server knows about the session, for seeding the client:
 *  - UserDto   : logged in
 *  - null      : definitely logged out (no auth cookies at all), so the client never probes
 *  - undefined : unknown (e.g. access cookie expired but a refresh cookie remains), so the client
 *                probes /auth/me, which silently refreshes. Public pages have no middleware
 *                to renew the session, so "unknown" must not be collapsed into "logged out".
 * `cache` dedupes it within a single request.
 */
export const getSessionSeed = cache(async (): Promise<UserDto | null | undefined> => {
  const jar = await cookies();
  if (!jar.has(AUTH_COOKIE.ACCESS) && !jar.has(AUTH_COOKIE.REFRESH)) return null;
  const { user } = await getSession();
  return user ?? undefined;
});

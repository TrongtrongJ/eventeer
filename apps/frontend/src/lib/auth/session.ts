import 'server-only';

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

import 'server-only';

import { redirect } from 'next/navigation';
import { getSession, canAccess, type Session } from './session';
import type { UserDto } from '@packages/shared-schemas';

/**
 * Server Component guard. Redirects unauthenticated visitors to /login
 * (the old <ProtectedRoute> did this on the client, causing a flash of
 * content first - this now happens before any HTML is sent).
 *
 * Role mismatches are returned rather than redirected, so the page can
 * render the same "Access Denied" panel the SPA used to show.
 */
export async function requireSession(
  requireRole?: UserDto['role'] | UserDto['role'][],
): Promise<{ session: Session; denied: boolean }> {
  const session = await getSession();

  if (!session.isAuthenticated) {
    redirect('/login');
  }

  const denied = !canAccess(session.user?.role, requireRole);
  return { session, denied };
}

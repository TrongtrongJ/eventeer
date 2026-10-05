import { os, ORPCError } from '@orpc/server';
import type { Request } from 'express';
import type { CurrentUserData } from '@packages/shared-schemas';

/**
 * Narrows `request.user` (populated by the global AuthenticationGuard) into the
 * typed oRPC context. The guard already rejects anonymous callers; this is the
 * type-level handoff plus a defensive check should a route ever be @Public().
 */
export const withCurrentUser = os.$context<{ request: Request }>().middleware(async ({ context, next }) => {
  const user = (context.request as Request & { user?: CurrentUserData }).user;

  if (!user) {
    throw new ORPCError('UNAUTHORIZED', { message: 'Authentication required' });
  }

  return next({ context: { user } });
});

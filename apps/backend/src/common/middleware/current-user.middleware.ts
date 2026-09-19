import { os, ORPCError } from '@orpc/server';
import type { Request } from 'express';

export interface CurrentUserData {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

export const withCurrentUser = os
  .$context<{ request: Request }>()
  .middleware(async ({ context, next }) => {
    const user = (context.request as any).user as CurrentUserData | undefined;

    if (!user) {
      throw new ORPCError('UNAUTHORIZED', { 
        message: 'Authentication required' 
      });
    }

    return next({
      context: { user }
    });
  });
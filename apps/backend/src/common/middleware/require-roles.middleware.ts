import { os, ORPCError } from '@orpc/server';
import type { CurrentUserData } from './current-user.middleware';

export const requireRoles = (allowedRoles: string[]) => 
  os
    .$context<{ user: CurrentUserData }>()
    .middleware(async ({ context, next }) => {
      
      if (!allowedRoles.includes(context.user.role)) {
        throw new ORPCError('FORBIDDEN', {
          message: 'Insufficient permissions to perform this action',
        });
      }

      return next({}); 
    });
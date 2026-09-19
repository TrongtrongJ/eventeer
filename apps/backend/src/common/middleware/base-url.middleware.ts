import { os } from '@orpc/server';
import type { Request } from 'express';

export const withBaseUrl = os
  .$context<{ request: Request }>()
  .middleware(async ({ context, next }) => {
    const req = context.request;
    
    const path = req.originalUrl.split('?')[0];
    const baseUrl = `${req.protocol}://${req.get('host')}${path}`;

    return next({
      context: { baseUrl }
    });
  });
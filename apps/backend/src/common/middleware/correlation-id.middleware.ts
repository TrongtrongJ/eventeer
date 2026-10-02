import { Request } from 'express';
import { os } from '@orpc/server';
import { v7 as uuidv7 } from 'uuid';
// Import the plugin context type to access resHeaders safely
import type { ResponseHeadersHandlerPluginContext } from '@orpc/server/plugins';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export const withCorrelationId = os
  // 1. Extend the expected context to include the resHeaders injected by the plugin
  .$context<{ request: Request } & ResponseHeadersHandlerPluginContext>()
  .middleware(async ({ context, next }) => {
    const headerId = context.request.headers[CORRELATION_ID_HEADER] as string;
    console.log('got into the middleware')
    const correlationId = headerId || uuidv7();
    console.log({correlationId})
    // 2. Set the header on the outgoing response so the client receives it
    // The plugin merges these into the final response
    context.resHeaders?.set(CORRELATION_ID_HEADER, correlationId);

    // 3. Manually mutate the Express request so your LoggingInterceptor can read it
    // after the middleware chain executes
    (context.request as any).correlationId = correlationId;

    // Inject the correlationId into the downstream context flow for your procedures
    return next({
      context: { correlationId }
    });
  });
import { Request } from 'express';
import { os } from '@orpc/server';
import { v7 as uuidv7 } from 'uuid';
import type { ResponseHeadersHandlerPluginContext } from '@orpc/server/plugins';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export const withCorrelationId = os
  .$context<{ request: Request } & ResponseHeadersHandlerPluginContext>()
  .middleware(async ({ context, next }) => {
    const incoming = context.request.headers[CORRELATION_ID_HEADER];
    // Accept a caller-supplied id only if it's a sane, bounded token.
    const correlationId =
      typeof incoming === 'string' && /^[\w-]{8,100}$/.test(incoming) ? incoming : uuidv7();

    context.resHeaders?.set(CORRELATION_ID_HEADER, correlationId);
    // Expose to the LoggingInterceptor, which runs outside the oRPC chain.
    (context.request as Request & { correlationId?: string }).correlationId = correlationId;

    return next({ context: { correlationId } });
  });

import { Request, Response, NextFunction } from 'express';
import { os } from '@orpc/server';
import { v7 as uuidv7 } from 'uuid';

declare module "@orpc/server" {
  interface DefaultInitialContext {
    request: Request;
  }
}
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/*export function CorrelationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers[CORRELATION_ID_HEADER] as string || uuidv7();
  req['correlationId'] = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
};*/

export const withCorrelationId = os
  // Explicitly expect the request object in the initial context
  .$context<{ request: Request }>()
  .middleware(async ({ context, next }) => {
    const headerId = context.request.headers[CORRELATION_ID_HEADER] as string;
    const correlationId = headerId || uuidv7();

    // Inject the correlationId into the downstream context flow
    return next({
      context: { correlationId }
    });
  });
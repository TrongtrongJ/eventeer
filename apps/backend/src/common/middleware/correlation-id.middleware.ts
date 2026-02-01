import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function CorrelationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers[CORRELATION_ID_HEADER] as string || uuidv4();
  req['correlationId'] = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
}
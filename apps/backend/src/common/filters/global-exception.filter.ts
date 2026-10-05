import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

const STATUS_TO_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_SUPPORTED',
  406: 'NOT_ACCEPTABLE',
  408: 'TIMEOUT',
  409: 'CONFLICT',
  412: 'PRECONDITION_FAILED',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  501: 'NOT_IMPLEMENTED',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * Normalises every error that escapes Nest (guards, pipes, plain controllers)
 * into the oRPC error wire format `{ defined, code, message, data? }` the frontend client expects.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  constructor(private readonly isProd: boolean) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // GraphQL has its own error pipeline (Apollo); hand the error back untouched.
    if (host.getType<string>() === 'graphql') return exception;

    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as any;

      // The oRPC OpenAPI client only accepts `{ defined, code, message, data? }` (no other keys);
      // anything else reaches the UI as MALFORMED_ORPC_RESPONSE and hides the real reason
      // (wrong password, sold out, bad coupon...). Errors that already come from oRPC are
      // valid as-is, so pass them through instead of wrapping them a second time.
      if (
        body &&
        typeof body === 'object' &&
        typeof body.defined === 'boolean' &&
        typeof body.code === 'string' &&
        typeof body.message === 'string'
      ) {
        const { defined, code, message, data } = body;
        return response.status(status).json({ defined, code, message, ...(data !== undefined ? { data } : {}) });
      }

      const message =
        typeof body === 'object' && Array.isArray(body?.message) ? body.message[0] : (body?.message ?? exception.message);
      return response.status(status).json({
        defined: false,
        code: STATUS_TO_CODE[status] ?? 'INTERNAL_SERVER_ERROR',
        message,
      });
    }

    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      defined: false,
      code: 'INTERNAL_SERVER_ERROR',
      // Never leak internals (SQL, stack hints) to clients in production.
      message: this.isProd || !(exception instanceof Error) ? 'Internal server error' : exception.message,
    });
  }
}

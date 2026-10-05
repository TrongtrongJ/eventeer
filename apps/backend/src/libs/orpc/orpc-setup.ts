import { ExecutionContext, HttpException } from '@nestjs/common';
import { ORPCModule } from '@orpc/nest';
import { ORPCError } from '@orpc/server';
import {
  ResponseHeadersHandlerPlugin,
  RequestHeadersHandlerPlugin,
  ResponseHeadersHandlerPluginContext,
  RequestHeadersHandlerPluginContext,
} from '@orpc/server/plugins';
import { Request } from 'express';

declare module '@orpc/server' {
  interface DefaultInitialContext extends RequestHeadersHandlerPluginContext, ResponseHeadersHandlerPluginContext {
    request: Request;
  }
}

const STATUS_TO_ORPC_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_SUPPORTED',
  408: 'TIMEOUT',
  409: 'CONFLICT',
  412: 'PRECONDITION_FAILED',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_CONTENT',
  429: 'TOO_MANY_REQUESTS',
  501: 'NOT_IMPLEMENTED',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

/**
 * oRPC converts any non-ORPCError thrown inside a handler into an opaque 500. Services throw
 * idiomatic Nest exceptions (BadRequest, Conflict, NotFound...), so translate them here once,
 * preserving the status and message, instead of wrapping every call site.
 */
const translateNestExceptions = async ({ next }: { next: () => Promise<unknown> }) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof HttpException) {
      const body = error.getResponse();
      const message = typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? error.message);
      throw new ORPCError(STATUS_TO_ORPC_CODE[error.getStatus()] ?? 'INTERNAL_SERVER_ERROR', {
        message: Array.isArray(message) ? message[0] : message,
        cause: error,
      });
    }
    throw error;
  }
};

/**
 * CORS is handled once, globally, by Nest (see app.setup.ts). The oRPC CORS
 * plugin was a redundant second layer, so it's gone.
 */
export function registerORPC() {
  return ORPCModule.forRoot({
    context: (ctx: ExecutionContext) => ({
      request: ctx.switchToHttp().getRequest<Request>(),
    }),
    plugins: [new RequestHeadersHandlerPlugin(), new ResponseHeadersHandlerPlugin()],
    clientInterceptors: [translateNestExceptions as any],
  });
}

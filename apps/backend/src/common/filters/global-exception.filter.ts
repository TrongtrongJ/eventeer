import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { ORPCError } from '@orpc/server';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 1. Let native oRPC errors pass through with their expected structure
    if (exception instanceof ORPCError) {
      // In oRPC v2, status is typically derived from the code, but fallback to 500
      const status = exception.code || 500;
      return response.status(status).json({
        code: exception.code,
        message: exception.message,
        data: exception.data,
      });
    }

    // 2. Transform standard NestJS HttpExceptions into oRPC format
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      
      // NestJS built-in pipes often return arrays of error messages
      const message = typeof exceptionResponse === 'object' && Array.isArray(exceptionResponse.message)
        ? exceptionResponse.message[0] 
        : exceptionResponse.message || exception.message;

      return response.status(status).json({
        code: this.mapStatusToORPCCode(status),
        message: message,
        data: typeof exceptionResponse === 'object' ? exceptionResponse : { details: exceptionResponse },
      });
    }

    // 3. Catch-all for unhandled internal server errors
    const internalMessage = exception instanceof Error ? exception.message : 'Internal server error';
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: internalMessage,
    });
  }

  // Helper to map NestJS HTTP status codes to strictly typed oRPC error codes
  private mapStatusToORPCCode(status: number): string {
    const oRpcCodes: Record<number, string> = {
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
    
    return oRpcCodes[status] || 'INTERNAL_SERVER_ERROR';
  }
}
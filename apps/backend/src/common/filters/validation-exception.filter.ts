import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const correlationId = (request.headers[CORRELATION_ID_HEADER] || 'unknown') as string;

    const exceptionResponse = exception.getResponse() as any;

    // Format validation errors nicely
    let formattedErrors: any[] = [];

    if (exceptionResponse.message && Array.isArray(exceptionResponse.message)) {
      formattedErrors = exceptionResponse.message.map((msg: string) => {
        // Parse constraint messages like "propertyName must be a valid email"
        const parts = msg.split(' ');
        const field = parts[0];
        const constraint = parts.slice(1).join(' ');

        return {
          field,
          message: constraint,
        };
      });
    } else if (exceptionResponse.errors) {
      // Zod validation errors
      formattedErrors = exceptionResponse.errors;
    }

    response.status(status).json({
      statusCode: status,
      message: 'Validation failed',
      error: 'ValidationError',
      errors: formattedErrors,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

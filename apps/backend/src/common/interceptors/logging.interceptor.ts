import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    // Do NOT destructure correlationId here!
    const { method, url, body } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = context.switchToHttp().getResponse();
          const { statusCode } = response;
          const duration = Date.now() - startTime;

          this.logger.log({
            message: 'Request completed',
            // Read it directly from the request object now that oRPC has mutated it
            correlationId: request.correlationId, 
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            bodySize: body ? JSON.stringify(body).length : 0,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error({
            message: 'Request failed',
            // Read it directly here as well
            correlationId: request.correlationId,
            method,
            url,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
          });
        },
      }),
    );
  }
}
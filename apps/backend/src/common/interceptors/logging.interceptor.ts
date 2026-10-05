import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<string>() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest();
    const startTime = Date.now();

    // correlationId is attached by the oRPC middleware *during* the handler, so read it lazily.
    const base = () => ({
      correlationId: request.correlationId,
      method: request.method,
      url: request.originalUrl,
      duration: `${Date.now() - startTime}ms`,
    });

    return next.handle().pipe(
      tap({
        next: () => this.logger.log({ message: 'Request completed', statusCode: http.getResponse().statusCode, ...base() }),
        error: (error) => this.logger.error({ message: 'Request failed', error: error?.message, ...base() }),
      }),
    );
  }
}

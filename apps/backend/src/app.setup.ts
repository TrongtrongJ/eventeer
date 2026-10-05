import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { json, raw } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import type { EnvConfig } from './env.validation';

/**
 * Everything that must be identical between the real server and integration
 * tests lives here, so tests exercise the same middleware/guards/CORS as prod.
 */
export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<EnvConfig, true>>(ConfigService);
  const isProd = config.get('isProd', { infer: true });

  // Correct client IPs (rate limiting, session metadata) when behind an ingress/LB.
  (app as NestExpressApplication).set('trust proxy', config.get('TRUST_PROXY', { infer: true }));

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: isProd }));

  // Nest's body parser is disabled (oRPC reads the stream itself). Stripe signature
  // verification needs the exact raw bytes, so parse ONLY the webhook route as a Buffer.
  app.use('/payment/webhook', raw({ type: 'application/json', limit: '1mb' }));
  // Same reason: oRPC owns the body stream, but Apollo's express integration needs a parsed body.
  app.use('/graphql', json({ limit: '100kb' }));
  app.use(cookieParser());

  app.useGlobalFilters(new GlobalExceptionFilter(isProd));
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Accept', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.enableShutdownHooks();
}

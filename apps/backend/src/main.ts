import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule, ObserveInstrument } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

//patchNestJsSwagger();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bodyParser: false,
    instrument: ObserveInstrument
  });

  // Log environment check
  const jwtSecret = process.env.JWT_ACCESS_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  
  if (!jwtSecret || !jwtRefreshSecret) {
    console.error('RITICAL: JWT secrets not configured!');
    console.error('Please set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in your .env file');
    console.warn('Using fallback secrets for development (NOT SECURE)');
  } else {
    console.log('JWT secrets configured');
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true, 
    
    // 3. Allow standard headers plus your custom correlation ID header
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'x-correlation-id', // Required because of your oRPC middleware
    ],
    
    // 4. Expose custom headers so the frontend can read them if needed
    exposedHeaders: ['x-correlation-id'], 
    
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
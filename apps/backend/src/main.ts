// Must be first: populates process.env before any decorator (e.g. the websocket
// gateway's CORS origin) is evaluated at import time.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { RedisIoAdapter } from './websocket/redis-io.adapter';
import type { EnvConfig } from './env.validation';

async function bootstrap() {
  // bodyParser is off: oRPC consumes the raw request stream itself.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);

  const config = app.get<ConfigService<EnvConfig, true>>(ConfigService);

  const ioAdapter = new RedisIoAdapter(app);
  ioAdapter.connectToRedis(config.get('REDIS_HOST', { infer: true }), config.get('REDIS_PORT', { infer: true }));
  app.useWebSocketAdapter(ioAdapter);

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();

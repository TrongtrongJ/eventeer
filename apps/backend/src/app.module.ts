import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { validate, EnvConfig } from './env.validation';
import { registerTypeORMWithConfig } from './config/typeorm.config';
import { registerBullMQWithConfig } from './config/bull.config';
import { registerORPC } from './libs/orpc/orpc-setup';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { OriginGuard } from './auth/guards/origin.guard';
import { AuthenticationGuard } from './auth/guards/authentication.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { BookingsModule } from './bookings/bookings.module';
import { CouponsModule } from './coupons/coupons.module';
import { PaymentModule } from './payment/payment.module';
import { EmailModule } from './email/email.module';
import { TicketsModule } from './tickets/tickets.module';
import { WebsocketModule } from './websocket/websocket.module';
import { HealthModule } from './health/health.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { GraphQLModule } from './graphql/graphql.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env', validate }),
    RedisModule.forRootAsync(
      {
        inject: [ConfigService],
        useFactory: (config: ConfigService<EnvConfig, true>) => ({
          config: { host: config.get('REDIS_HOST', { infer: true }), port: config.get('REDIS_PORT', { infer: true }) },
        }),
      },
      true, // global: one connection shared by sessions, health, and anything else
    ),
    // ttl is in MILLISECONDS in @nestjs/throttler v6. Auth routes override with stricter limits.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      imports: [ConfigModule],
      useFactory: (config: ConfigService<EnvConfig, true>) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        skipIf: () => !config.get('RATE_LIMIT_ENABLED', { infer: true }),
      }),
    }),
    registerTypeORMWithConfig(),
    registerBullMQWithConfig(),
    registerORPC(),
    AuthModule,
    EventsModule,
    BookingsModule,
    CouponsModule,
    PaymentModule,
    EmailModule,
    TicketsModule,
    WebsocketModule,
    HealthModule,
    MaintenanceModule,
    GraphQLModule,
  ],
  providers: [
    // Order matters: throttle -> CSRF origin check -> authenticate -> authorize.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

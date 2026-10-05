import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import type { EnvConfig } from '../env.validation';

export function registerBullMQWithConfig() {
  return BullModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService<EnvConfig, true>) => ({
      redis: { host: config.get('REDIS_HOST', { infer: true }), port: config.get('REDIS_PORT', { infer: true }) },
    }),
  });
}

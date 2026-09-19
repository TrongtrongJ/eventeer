import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bull";

export function registerBullMQWithConfig() {
  return BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
      }),
    })
}
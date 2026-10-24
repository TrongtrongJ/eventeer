import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bull";
import type { EnvConfig } from "../env.validation";
import { CircuitOpenError } from "@nestjs/resilience";

export function registerBullMQWithConfig() {
    return BullModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService<EnvConfig, true>) => ({
            redis: { host: config.get("REDIS_HOST", { infer: true }), port: config.get("REDIS_PORT", { infer: true }) },
            settings: {
              backoffStrategies: {
                  smtp: (attemptsMade: number, err?: Error) =>
                      err instanceof CircuitOpenError ? 60_000 : Math.min(2 ** attemptsMade * 2_000, 300_000),
              },
            },
        }),
    });
}

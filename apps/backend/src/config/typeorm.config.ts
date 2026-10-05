import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvConfig } from '../env.validation';
import { ENTITIES } from './entities';
import { MIGRATIONS } from '../migrations';

export function registerTypeORMWithConfig() {
  return TypeOrmModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService<EnvConfig, true>) => ({
      type: 'postgres' as const,
      host: config.get('DB_HOST', { infer: true }),
      port: config.get('DB_PORT', { infer: true }),
      username: config.get('DB_USERNAME', { infer: true }),
      password: config.get('DB_PASSWORD', { infer: true }),
      database: config.get('DB_NAME', { infer: true }),
      entities: ENTITIES,
      // Schema is owned by migrations, never by synchronize. Dev/test apply them on boot;
      // production runs them explicitly (see k8s/migration-job.yaml) to avoid replica races.
      synchronize: false,
      migrations: MIGRATIONS,
      migrationsRun: !config.get('isProd', { infer: true }),
      logging: config.get('isDev', { infer: true }) ? ['error', 'warn', 'migration'] : ['error'],
      ssl: config.get('DB_SSL', { infer: true }) ? { rejectUnauthorized: false } : false,
      extra: { statement_timeout: 10_000 },
    }),
  });
}

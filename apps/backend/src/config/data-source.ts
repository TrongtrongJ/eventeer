import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';
import { MIGRATIONS } from '../migrations';

/** Used by the TypeORM CLI (migration:generate/run) and the seed script. */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'event_management',
  entities: ENTITIES,
  migrations: MIGRATIONS,
});

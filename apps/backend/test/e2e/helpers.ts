import { config } from 'dotenv';
import { Client } from 'pg';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';

config({ path: '.env.test', override: true });

/** Creates the dedicated test database on first run so the suite is self-contained. */
async function ensureDatabase() {
  const name = process.env.DB_NAME!;
  const admin = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!rowCount) await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();
}

export async function bootApp() {
  // The suite TRUNCATEs every table. Never let it near a database that isn't clearly a test one.
  if (!process.env.DB_NAME?.endsWith('_test')) {
    throw new Error(`Refusing to run e2e tests against "${process.env.DB_NAME}": DB_NAME must end with "_test"`);
  }
  await ensureDatabase();
  // Imported lazily so dotenv has populated process.env before decorators evaluate.
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/app.setup.js');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  await dataSource.query('TRUNCATE users, events, coupons, bookings, tickets, auth_sessions RESTART IDENTITY CASCADE');
  return { app, dataSource };
}

export const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export const credentials = (email: string) => ({ email, password: 'Secret123', firstName: 'Test', lastName: 'User' });

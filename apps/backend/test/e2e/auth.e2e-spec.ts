import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { bootApp, credentials } from './helpers';

const cookieValue = (res: request.Response, name: string): string | undefined => {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return raw.find((c) => c.startsWith(`${name}=`))?.split(';')[0].split('=')[1];
};

describe('Opaque cookie auth (E2E)', () => {
  let app: NestExpressApplication;
  let db: DataSource;

  beforeAll(async () => ({ app, dataSource: db } = await bootApp()));
  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  it('register sets httpOnly cookies and never returns tokens in the body', async () => {
    const res = await http().post('/auth/register').send(credentials('Auth@Test.com')).expect(200);

    const cookies = ([] as string[]).concat(res.headers['set-cookie']);
    expect(cookies).toHaveLength(2);
    for (const c of cookies) {
      expect(c).toMatch(/HttpOnly/i);
      expect(c).toMatch(/SameSite=Lax/i);
      expect(c).toMatch(/Path=\//);
    }
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
    expect(res.body.data.user.email).toBe('auth@test.com'); // normalised
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('defaults to CUSTOMER and honours an ORGANIZER sign-up role', async () => {
    const customer = await http().post('/auth/register').send(credentials('plain@test.com')).expect(200);
    expect(customer.body.data.user.role).toBe('CUSTOMER');

    const organizer = await http()
      .post('/auth/register')
      .send({ ...credentials('org@test.com'), role: 'ORGANIZER' })
      .expect(200);
    expect(organizer.body.data.user.role).toBe('ORGANIZER');

    await http()
      .post('/auth/register')
      .send({ ...credentials('bad@test.com'), role: 'SUPERUSER' })
      .expect(400);
  });

  it('stores only hashes, never the raw tokens', async () => {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/auth/login').send({ email: 'auth@test.com', password: 'Secret123' }).expect(200);
    const raw = cookieValue(res, 'access_token')!;
    const rows = await db.query('SELECT "accessTokenHash" FROM auth_sessions');
    expect(rows.some((r: any) => r.accessTokenHash === raw)).toBe(false);
  });

  it('is default-deny: anonymous callers get 401 on protected routes but can read public ones', async () => {
    await http().get('/auth/me').expect(401);
    await http().get('/bookings/booking/me').expect(401);
    await http().get('/events').expect(200);
  });

  it('rejects wrong passwords and weak registrations', async () => {
    await http().post('/auth/login').send({ email: 'auth@test.com', password: 'Wrong12345' }).expect(401);
    await http().post('/auth/register').send({ ...credentials('weak@test.com'), password: 'weak' }).expect(400);
    await http().post('/auth/register').send(credentials('AUTH@test.com')).expect(409);
  });

  it('rotates refresh tokens and detects replay of a rotated token', async () => {
    const login = await http().post('/auth/login').send({ email: 'auth@test.com', password: 'Secret123' }).expect(200);
    const oldRefresh = cookieValue(login, 'refresh_token')!;
    const oldAccess = cookieValue(login, 'access_token')!;

    const refreshed = await http().post('/auth/refresh').set('Cookie', `refresh_token=${oldRefresh}`).expect(200);
    const newAccess = cookieValue(refreshed, 'access_token')!;
    expect(newAccess).toBeTruthy();
    expect(newAccess).not.toBe(oldAccess);

    // Old access token is dead immediately; new one works.
    await http().get('/auth/me').set('Cookie', `access_token=${oldAccess}`).expect(401);
    await http().get('/auth/me').set('Cookie', `access_token=${newAccess}`).expect(200);

    // Replay inside the grace window (concurrent SSR+browser): tolerated, but mints nothing.
    const grace = await http().post('/auth/refresh').set('Cookie', `refresh_token=${oldRefresh}`).expect(200);
    expect(grace.headers['set-cookie']).toBeUndefined();

    // Replay AFTER the grace window is treated as theft: the whole session is revoked.
    await db.query(`UPDATE auth_sessions SET "rotatedAt" = now() - interval '1 minute' WHERE "previousRefreshTokenHash" IS NOT NULL`);
    await http().post('/auth/refresh').set('Cookie', `refresh_token=${oldRefresh}`).expect(401);
    await http().get('/auth/me').set('Cookie', `access_token=${newAccess}`).expect(401);
  });

  it('logout is idempotent, revokes the session and clears cookies', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email: 'auth@test.com', password: 'Secret123' }).expect(200);
    await agent.get('/auth/me').expect(200);

    const out = await agent.post('/auth/logout').expect(200);
    expect(([] as string[]).concat(out.headers['set-cookie']).join(';')).toMatch(/access_token=;/);
    await agent.get('/auth/me').expect(401);
    await http().post('/auth/logout').expect(200); // no cookies at all: still fine
  });

  it('blocks cross-origin state-changing requests (CSRF) but allows the web app origin', async () => {
    const body = { email: 'auth@test.com', password: 'Wrong12345' };
    await http().post('/auth/login').set('Origin', 'https://evil.example').send(body).expect(403);
    await http().post('/auth/login').set('Origin', 'http://localhost:3000').send(body).expect(401);
  });

  it('password reset revokes every existing session', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/login').send({ email: 'auth@test.com', password: 'Secret123' }).expect(200);

    // Email is disabled in tests, so plant a known reset token the way the service would.
    const { hashToken } = await import('../../src/auth/utils/token.util.js');
    await db.query(
      `UPDATE users SET "passwordResetToken" = $1, "passwordResetExpires" = now() + interval '1 hour' WHERE email = $2`,
      [hashToken('reset-token-123'), 'auth@test.com'],
    );

    await http().post('/auth/reset-password').send({ token: 'reset-token-123', newPassword: 'Brandnew123' }).expect(200);
    await agent.get('/auth/me').expect(401);
    await http().post('/auth/login').send({ email: 'auth@test.com', password: 'Brandnew123' }).expect(200);
    await http().post('/auth/reset-password').send({ token: 'reset-token-123', newPassword: 'Another1234' }).expect(400); // single use
  });
});

import { validate } from './env.validation';

const prod = {
  NODE_ENV: 'production',
  FRONTEND_URL: 'https://eventeer.example',
  STRIPE_SECRET_KEY: 'sk_live_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_x',
};

describe('env validation', () => {
  it('applies safe defaults in development', () => {
    const env = validate({});
    expect(env.isDev).toBe(true);
    expect(env.accessTokenMs).toBe(15 * 60_000);
    expect(env.refreshTokenMs).toBe(7 * 24 * 3600_000);
  });

  it('refuses to boot production without Stripe (no silent mock payments)', () => {
    expect(() => validate({ ...prod, STRIPE_SECRET_KEY: undefined })).toThrow(/STRIPE_SECRET_KEY/);
    expect(() => validate({ ...prod, STRIPE_WEBHOOK_SECRET: undefined })).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  it('requires https in production because cookies are Secure', () => {
    expect(() => validate({ ...prod, FRONTEND_URL: 'http://eventeer.example' })).toThrow(/https/);
  });

  it('accepts a complete production config', () => {
    expect(validate(prod).isProd).toBe(true);
  });

  it('allows admin sign-up outside production by default, refuses it in production', () => {
    expect(validate({}).allowAdminSignup).toBe(true);
    expect(validate(prod).allowAdminSignup).toBe(false);
  });

  it('lets ALLOW_ADMIN_SIGNUP override the default either way', () => {
    expect(validate({ ALLOW_ADMIN_SIGNUP: 'false' }).allowAdminSignup).toBe(false);
    expect(validate({ ...prod, ALLOW_ADMIN_SIGNUP: 'true' }).allowAdminSignup).toBe(true);
  });

  it('rejects malformed durations', () => {
    expect(() => validate({ ACCESS_TOKEN_TTL: 'soon' })).toThrow();
  });
});

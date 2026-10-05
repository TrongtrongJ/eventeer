import { ForbiddenException } from '@nestjs/common';
import { OriginGuard } from './origin.guard';

const ctx = (method: string, headers: Record<string, string>) =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  }) as any;

describe('OriginGuard (CSRF defence in depth)', () => {
  const guard = new OriginGuard({ get: () => 'https://app.example' } as any);

  it('always allows safe methods', () => {
    expect(guard.canActivate(ctx('GET', { origin: 'https://evil.example' }))).toBe(true);
  });

  it('allows unsafe requests from the web app origin', () => {
    expect(guard.canActivate(ctx('POST', { origin: 'https://app.example', host: 'api.example' }))).toBe(true);
  });

  it('allows requests with no Origin (curl, webhooks): they cannot carry a victim\'s cookies', () => {
    expect(guard.canActivate(ctx('POST', {}))).toBe(true);
  });

  it('blocks unsafe cross-origin requests', () => {
    expect(() => guard.canActivate(ctx('POST', { origin: 'https://evil.example', host: 'api.example' }))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks malformed Origin headers', () => {
    expect(() => guard.canActivate(ctx('DELETE', { origin: 'not a url', host: 'api.example' }))).toThrow(ForbiddenException);
  });
});

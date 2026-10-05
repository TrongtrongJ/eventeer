import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test-utils/server';
import { apiUrl } from '../config';
import { bookingsClient, SESSION_EXPIRED_EVENT } from '../browser-client';
import { wrapResponse, apiError } from '@/test-utils/response-envelope';

const PROTECTED = `${apiUrl}/bookings/booking/me`;
const REFRESH = `${apiUrl}/auth/refresh`;

/** Protected endpoint that 401s until `refresh` has been called, like an expired access cookie. */
function expiredThenRenewed() {
  const calls = { protected: 0, refresh: 0 };
  let renewed = false;
  server.use(
    http.get(PROTECTED, () => {
      calls.protected++;
      return renewed
        ? HttpResponse.json(wrapResponse([]), { status: 200 })
        : HttpResponse.json(apiError('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }),
    http.post(REFRESH, async () => {
      calls.refresh++;
      await new Promise((r) => setTimeout(r, 20)); // keep it in flight so parallel callers overlap
      renewed = true;
      return HttpResponse.json(wrapResponse({}), { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => vi.restoreAllMocks());

describe('browser client: silent session renewal', () => {
  it('on a 401, refreshes once and transparently replays the request', async () => {
    const calls = expiredThenRenewed();

    const result = await bookingsClient.getMyBookings();

    expect(result.data).toEqual([]);
    expect(calls).toEqual({ protected: 2, refresh: 1 }); // original + exactly one replay
  });

  it('shares ONE refresh between parallel 401s (refresh tokens rotate; concurrent use looks like replay)', async () => {
    const calls = expiredThenRenewed();

    await Promise.all([bookingsClient.getMyBookings(), bookingsClient.getMyBookings(), bookingsClient.getMyBookings()]);

    expect(calls.refresh).toBe(1);
  });

  it('when the refresh fails, surfaces the 401 and announces that the session expired', async () => {
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    server.use(
      http.get(PROTECTED, () => HttpResponse.json(apiError('UNAUTHORIZED', 'Authentication required'), { status: 401 })),
      http.post(REFRESH, () => HttpResponse.json(apiError('UNAUTHORIZED', 'Refresh failed'), { status: 401 })),
    );

    await expect(bookingsClient.getMyBookings()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });

  it('never refreshes on a failed login (a wrong password is not an expired session)', async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${apiUrl}/auth/login`, () => HttpResponse.json(apiError('UNAUTHORIZED', 'Invalid email or password'), { status: 401 })),
      http.post(REFRESH, () => {
        refreshCalls++;
        return HttpResponse.json({}, { status: 200 });
      }),
    );
    const { authClient } = await import('../browser-client');

    await expect(authClient.login({ email: 'a@b.com', password: 'x' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(refreshCalls).toBe(0);
  });
});

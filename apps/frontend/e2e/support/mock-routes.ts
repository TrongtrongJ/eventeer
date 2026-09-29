import type { Page, BrowserContext } from '@playwright/test';
import {
  E2E_TOKENS,
  type E2ERole,
  extractCookieValue,
  mockBooking,
  mockEvent,
  mockUsers,
  userForToken,
  validLoginEmail,
  validLoginPassword,
  wrapPaginated,
  wrapResponse,
} from '../../src/mocks/fixtures';

const API_URL = 'http://localhost:4000';

/** Logs a test in without going through the login form - sets the cookie directly. */
export async function loginAsRole(context: BrowserContext, role: E2ERole) {
  await context.addCookies([
    {
      name: 'access_token',
      value: E2E_TOKENS[role],
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
  ]);
}

/** GET /auth/me - reads the access_token cookie straight off the request, same convention the Node mock uses. */
export async function mockAuthMe(page: Page) {
  await page.route(`${API_URL}/auth/me`, async (route) => {
    const cookieHeader = route.request().headers()['cookie'];
    const token = extractCookieValue(cookieHeader, 'access_token');
    const user = userForToken(token);
    if (!user) {
      await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      return;
    }
    await route.fulfill({ status: 200, json: wrapResponse(user) });
  });
}

/** POST /auth/login - sets the httpOnly cookie via the browser context directly (Set-Cookie header + fulfill doesn't reliably do this for msw-fulfilled routes). */
export function mockLogin(page: Page, context: BrowserContext) {
  return page.route(`${API_URL}/auth/login`, async (route) => {
    const body = route.request().postDataJSON() as { email: string; password: string };

    if (body.email !== validLoginEmail || body.password !== validLoginPassword) {
      await route.fulfill({ status: 401, json: { message: 'Invalid credentials' } });
      return;
    }

    await context.addCookies([
      { name: 'access_token', value: E2E_TOKENS.CUSTOMER, domain: 'localhost', path: '/', httpOnly: true },
      { name: 'refresh_token', value: 'e2e-refresh-token', domain: 'localhost', path: '/', httpOnly: true },
    ]);

    await route.fulfill({
      status: 200,
      json: wrapResponse({
        accessToken: E2E_TOKENS.CUSTOMER,
        refreshToken: 'e2e-refresh-token',
        user: { id: mockUsers.CUSTOMER.id, email: mockUsers.CUSTOMER.email },
        expiresIn: 3600,
      }),
    });
  });
}

/** POST /auth/logout - clears the cookies the same way the real backend would. */
export function mockLogout(page: Page, context: BrowserContext) {
  return page.route(`${API_URL}/auth/logout`, async (route) => {
    await context.clearCookies({ name: 'access_token' });
    await context.clearCookies({ name: 'refresh_token' });
    await route.fulfill({ status: 200, json: wrapResponse(null) });
  });
}

/** GET /events - paginated list, single fixture event. */
export function mockEventsList(page: Page) {
  return page.route(`${API_URL}/events`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ status: 200, json: wrapPaginated([mockEvent]) });
  });
}

/** GET /events/:id */
export function mockEventDetail(page: Page) {
  return page.route(`${API_URL}/events/${mockEvent.id}`, async (route) => {
    await route.fulfill({ status: 200, json: wrapResponse(mockEvent) });
  });
}

/** POST /bookings/create */
export function mockCreateBooking(page: Page) {
  return page.route(`${API_URL}/bookings/create`, async (route) => {
    await route.fulfill({ status: 201, json: wrapResponse(mockBooking) });
  });
}

/** GET /bookings/:id */
export function mockBookingDetail(page: Page) {
  return page.route(`${API_URL}/bookings/${mockBooking.id}`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ status: 200, json: wrapResponse(mockBooking) });
  });
}

/** GET /observability/health and /observability/metrics - plain (non-oRPC) fetches used by the metrics page. */
export function mockObservability(page: Page) {
  return Promise.all([
    page.route(`${API_URL}/observability/health`, (route) =>
      route.fulfill({
        status: 200,
        json: wrapResponse({
          status: 'healthy',
          uptime: 3600,
          memory: { used: 128, total: 512, percentage: 25 },
          cpu: { usage: 12, loadAverage: [0.1, 0.2, 0.3] },
        }),
      }),
    ),
    page.route(`${API_URL}/observability/metrics`, (route) =>
      route.fulfill({
        status: 200,
        json: wrapResponse({
          requests: { total: 100, success: 95, errors: 5, byEndpoint: {} },
          response: { averageTime: 50, p95: 120, p99: 200 },
          database: { queries: { total: 200, slow: 2, errors: 0, averageTime: 10 } },
          business: {
            events: { total: 1, active: 1, soldOut: 0, topEvents: [] },
            bookings: { total: 0, confirmed: 0, revenue: { total: 0, thisMonth: 0, growth: 0 } },
            users: { total: 3, active: 3, newToday: 0, newThisWeek: 0 },
          },
        }),
      }),
    ),
  ]);
}

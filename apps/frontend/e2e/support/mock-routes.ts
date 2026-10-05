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
      await route.fulfill({ status: 401, json: { defined: false, code: 'UNAUTHORIZED', message: 'Unauthorized' } });
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
      await route.fulfill({ status: 401, json: { defined: false, code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
      return;
    }

    await context.addCookies([
      { name: 'access_token', value: E2E_TOKENS.CUSTOMER, domain: 'localhost', path: '/', httpOnly: true },
      { name: 'refresh_token', value: 'e2e-refresh-token', domain: 'localhost', path: '/', httpOnly: true },
    ]);

    await route.fulfill({
      status: 200,
      // Tokens travel only in the httpOnly cookies set above, never in the body.
      json: wrapResponse({ user: mockUsers.CUSTOMER }),
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

import { http, HttpHandler, HttpResponse } from 'msw';
import { apiUrl } from '@/lib/orpc/config';
import { apiError } from './response-envelope';

/**
 * Defaults every test gets. The browser client silently tries POST /auth/refresh after any
 * 401, so an unauthenticated test needs refresh to fail the way a logged-out session does.
 */
export const handlers: HttpHandler[] = [
  http.post(`${apiUrl}/auth/refresh`, () => HttpResponse.json(apiError('UNAUTHORIZED', 'Missing refresh token'), { status: 401 })),
];

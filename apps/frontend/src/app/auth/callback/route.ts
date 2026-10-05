import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, getCookieOptions } from '@packages/shared-schemas';

/**
 * The backend's OAuth callbacks (google/github/facebook) redirect here with
 * `?accessToken=...&refreshToken=...` in the URL, unlike the regular
 * login/register flow which sets httpOnly cookies directly on its own
 * response. This route bridges the gap by setting the same cookies
 * (same names + options the backend itself uses) before redirecting home,
 * so the OAuth flow ends up in the exact same cookie-authenticated state.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.nextUrl.searchParams.get('accessToken');
  const refreshToken = request.nextUrl.searchParams.get('refreshToken');

  const redirectUrl = new URL(accessToken && refreshToken ? '/' : '/login', request.url);
  if (!accessToken || !refreshToken) {
    redirectUrl.searchParams.set('error', 'oauth_failed');
  }

  const response = NextResponse.redirect(redirectUrl);

  if (accessToken && refreshToken) {
    const cookieStore = response.cookies;
    cookieStore.set(AUTH_COOKIE.ACCESS, accessToken, getCookieOptions());
    cookieStore.set(AUTH_COOKIE.REFRESH, refreshToken, getCookieOptions());
  }

  return response;
}

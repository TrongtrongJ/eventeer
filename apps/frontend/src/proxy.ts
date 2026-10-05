import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@packages/shared-schemas';
import { serverApiUrl } from '@/lib/orpc/config';

// Keep this list in sync with the protected pages under src/app. This only decides
// "should we try to establish a session"; the authoritative auth + role check
// happens server-side in each page via requireSession().
const PROTECTED_PREFIXES = ['/checkout', '/booking', '/profile', '/bookings', '/create', '/my-events'];

function isProtected(pathname: string) {
  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  // /events/:id/coupons and /events/:id/coupons/create
  return /^\/events\/[^/]+\/coupons(\/create)?$/.test(pathname);
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', request.nextUrl.pathname);
  const response = NextResponse.redirect(loginUrl);
  // A refresh cookie that just failed is dead weight; drop it so we stop retrying.
  response.cookies.delete(AUTH_COOKIE.REFRESH);
  return response;
}

/** Cookie header for the *current* request with `updates` merged over it. */
function mergeCookieHeader(request: NextRequest, updates: Map<string, string>) {
  const jar = new Map(request.cookies.getAll().map((c) => [c.name, c.value]));
  updates.forEach((value, name) => jar.set(name, value));
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

export async function proxy(request: NextRequest) {
  if (!isProtected(request.nextUrl.pathname)) return NextResponse.next();

  // Fast path: an access cookie is present (the API validates it for real).
  if (request.cookies.has(AUTH_COOKIE.ACCESS)) return NextResponse.next();

  // The access cookie is short-lived and the browser drops it when it expires. If a refresh
  // cookie remains, renew the session HERE so server components see fresh cookies on this
  // very request, instead of bouncing a still-logged-in user to /login every 15 minutes.
  const refreshToken = request.cookies.get(AUTH_COOKIE.REFRESH)?.value;
  if (!refreshToken) return redirectToLogin(request);

  try {
    const res = await fetch(`${serverApiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { cookie: `${AUTH_COOKIE.REFRESH}=${refreshToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return redirectToLogin(request);

    const setCookies = res.headers.getSetCookie();
    const fresh = new Map<string, string>();
    for (const line of setCookies) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      fresh.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
    }

    // No cookies in the reply means a concurrent request already rotated the token and
    // delivered new cookies to the browser; let this request through to render.
    if (!fresh.size) return NextResponse.next();

    const headers = new Headers(request.headers);
    headers.set('cookie', mergeCookieHeader(request, fresh));
    const response = NextResponse.next({ request: { headers } });
    // Forward the API's Set-Cookie headers verbatim (httpOnly, SameSite, expiry intact).
    setCookies.forEach((line) => response.headers.append('set-cookie', line));
    return response;
  } catch {
    return redirectToLogin(request);
  }
}

export const config = {
  matcher: [
    '/checkout/:path*',
    '/booking/:path*',
    '/profile',
    '/bookings',
    '/create',
    '/my-events',
    '/events/:eventId/coupons',
    '/events/:eventId/coupons/create',
  ],
};

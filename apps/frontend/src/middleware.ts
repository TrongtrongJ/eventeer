import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@packages/shared-schemas';

// Keep this list in sync with the protected pages under src/app.
// This is a fast, presence-only check (no token validation) to avoid a
// flash of protected content; the real auth + role check happens
// server-side in each page via requireSession().
const PROTECTED_PREFIXES = [
  '/checkout',
  '/booking',
  '/profile',
  '/bookings',
  '/create',
  '/metrics',
  '/my-events',
];

function isProtected(pathname: string) {
  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  // /events/:id/coupons and /events/:id/coupons/create
  if (/^\/events\/[^/]+\/coupons(\/create)?$/.test(pathname)) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProtected(pathname) && !request.cookies.has(AUTH_COOKIE.ACCESS)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/checkout/:path*',
    '/booking/:path*',
    '/profile',
    '/bookings',
    '/create',
    '/metrics',
    '/my-events',
    '/events/:eventId/coupons',
    '/events/:eventId/coupons/create',
  ],
};

import createMiddleware from 'next-intl/middleware';
import { routing } from './routing'; // or wherever you place the file

export default createMiddleware(routing);

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(th|en)/:path*']
};
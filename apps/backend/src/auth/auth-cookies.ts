import { deleteCookie, setCookie } from '@orpc/server/helpers';
import type { Response } from 'express';
import { AUTH_COOKIE, getCookieOptions } from '@packages/shared-schemas';
import type { IssuedTokens } from './session.service';

/**
 * Both cookies are httpOnly, SameSite=Lax, Path=/ and (outside dev) Secure.
 * `expires` is used instead of `maxAge` because Express (ms) and the `cookie`
 * package used by oRPC (seconds) disagree on maxAge units.
 *
 * The refresh cookie is scoped to Path=/ (not /auth) on purpose: the Next.js
 * middleware must be able to see it on any page route to transparently renew
 * an expired access cookie before server components render.
 */
export function setAuthCookies(headers: Headers | undefined, tokens: IssuedTokens, secure: boolean): void {
  setCookie(headers, AUTH_COOKIE.ACCESS, tokens.accessToken, {
    ...getCookieOptions({ secure, expires: tokens.accessExpiresAt }),
  });
  setCookie(headers, AUTH_COOKIE.REFRESH, tokens.refreshToken, {
    ...getCookieOptions({ secure, expires: tokens.refreshExpiresAt }),
  });
}

export function clearAuthCookies(headers: Headers | undefined, secure: boolean): void {
  const opts = { path: '/', httpOnly: true, secure, sameSite: 'lax' as const };
  deleteCookie(headers, AUTH_COOKIE.ACCESS, opts);
  deleteCookie(headers, AUTH_COOKIE.REFRESH, opts);
}

/** Express flavour, used by the OAuth redirect handlers. */
export function setAuthCookiesOnResponse(res: Response, tokens: IssuedTokens, secure: boolean): void {
  const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
  res.cookie(AUTH_COOKIE.ACCESS, tokens.accessToken, { ...base, expires: tokens.accessExpiresAt });
  res.cookie(AUTH_COOKIE.REFRESH, tokens.refreshToken, { ...base, expires: tokens.refreshExpiresAt });
}

import { test, expect } from '@playwright/test';

/**
 * app/auth/callback/route.ts bridges the backend's OAuth redirect (tokens in
 * the query string) into httpOnly cookies. This is pure route-handler logic
 * with no backend call, so it's testable without any mocking at all.
 */
test.describe('OAuth callback bridge', () => {
  test('sets cookies and redirects home on valid tokens', async ({ page, context }) => {
    await page.goto('/auth/callback?accessToken=fake-access&refreshToken=fake-refresh');
    await expect(page).toHaveURL('/');

    const cookies = await context.cookies();
    const accessCookie = cookies.find((c) => c.name === 'access_token');
    const refreshCookie = cookies.find((c) => c.name === 'refresh_token');

    expect(accessCookie?.value).toBe('fake-access');
    expect(accessCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.value).toBe('fake-refresh');
  });

  test('redirects to login with an error when tokens are missing', async ({ page, context }) => {
    await page.goto('/auth/callback');
    await expect(page).toHaveURL('/login?error=oauth_failed');

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'access_token')).toBeUndefined();
  });
});

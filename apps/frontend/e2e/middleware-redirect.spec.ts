import { test, expect } from '@playwright/test';

/**
 * middleware.ts only checks for the access_token cookie's presence - no
 * backend call happens here, so this test needs zero mocking. It's the
 * fastest possible signal that the middleware file is actually being picked
 * up by Next.js (it silently does nothing if misplaced relative to src/).
 */
test.describe('middleware route protection', () => {
  const protectedPaths = ['/bookings', '/profile', '/create', '/metrics', '/my-events'];

  for (const path of protectedPaths) {
    test(`redirects ${path} to /login when logged out`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?from=/);
    });
  }

  test('preserves the original destination in the redirect', async ({ page }) => {
    await page.goto('/bookings');
    await expect(page).toHaveURL(`/login?from=${encodeURIComponent('/bookings')}`);
  });

  test('does not redirect public pages', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL('/login');
  });
});

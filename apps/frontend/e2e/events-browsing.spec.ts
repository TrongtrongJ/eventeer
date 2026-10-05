import { test, expect } from '@playwright/test';
import { mockAuthMe, mockEventDetail } from './support/mock-routes';
import { mockEvent } from '../src/mocks/fixtures';

/**
 * The home page and event detail page fetch their data server-side
 * (createServerOrpc in a Server Component), which the Node-side MSW server
 * booted by instrumentation.ts handles automatically - no page.route needed
 * for those. mockAuthMe is still needed because Navigation is a client
 * component that separately queries /auth/me in the browser.
 */
test.describe('browsing events', () => {
  test('renders the event fetched server-side on the home page', async ({ page }) => {
    await mockAuthMe(page);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: mockEvent.title })).toBeVisible();
    await expect(page.getByText(mockEvent.location)).toBeVisible();
  });

  test('renders event details server-side and prompts login when logged out', async ({ page }) => {
    await mockAuthMe(page);

    await page.goto(`/events/${mockEvent.id}`);

    await expect(page.getByRole('heading', { name: mockEvent.title })).toBeVisible();
    await expect(page.getByText(/please/i).and(page.getByText(/login/i))).toBeVisible();
  });

  test('shows the booking form instead of the login prompt when authenticated', async ({
    page,
    context,
  }) => {
    await mockAuthMe(page);
    await mockEventDetail(page);
    await context.addCookies([
      { name: 'access_token', value: 'e2e-customer-token', domain: 'localhost', path: '/', httpOnly: true },
    ]);

    await page.goto(`/events/${mockEvent.id}`);

    await expect(page.getByRole('button', { name: 'Proceed to Payment' })).toBeVisible();
  });

  test('returns a 404 page for an unknown event id', async ({ page }) => {
    await mockAuthMe(page);

    const response = await page.goto('/events/does-not-exist');
    expect(response?.status()).toBe(404);
  });
});

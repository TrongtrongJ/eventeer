import { test, expect } from '@playwright/test';
import { mockAuthMe, loginAsRole, mockObservability } from './support/mock-routes';

/**
 * requireSession(['ORGANIZER', 'ADMIN']) runs server-side in the page itself
 * (see app/create/page.tsx), not just as a client-side UI hide - this test
 * confirms a CUSTOMER genuinely gets the Access Denied panel server-rendered,
 * not merely a hidden nav link they could route around.
 */
test.describe('role-based page access', () => {
  test('CUSTOMER sees Access Denied on the organizer-only create page', async ({ page, context }) => {
    await mockAuthMe(page);
    await loginAsRole(context, 'CUSTOMER');

    await page.goto('/create');

    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByLabel('Event Title *')).toHaveCount(0);
  });

  test('ORGANIZER can access the create page', async ({ page, context }) => {
    await mockAuthMe(page);
    await loginAsRole(context, 'ORGANIZER');

    await page.goto('/create');

    await expect(page.getByRole('heading', { name: 'Create New Event' })).toBeVisible();
  });

  test('CUSTOMER is redirected away from create with no cookie at all', async ({ page }) => {
    await page.goto('/create');
    await expect(page).toHaveURL(/\/login/);
  });

  test('ADMIN can access the admin-only metrics page', async ({ page, context }) => {
    await mockAuthMe(page);
    await mockObservability(page);
    await loginAsRole(context, 'ADMIN');

    await page.goto('/metrics');

    await expect(page.getByRole('heading', { name: 'Access Denied' })).toHaveCount(0);
  });

  test('ORGANIZER is denied the admin-only metrics page', async ({ page, context }) => {
    await mockAuthMe(page);
    await loginAsRole(context, 'ORGANIZER');

    await page.goto('/metrics');

    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
  });
});

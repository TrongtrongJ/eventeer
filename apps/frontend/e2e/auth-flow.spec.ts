import { test, expect } from '@playwright/test';
import { mockAuthMe, mockLogin, mockLogout } from './support/mock-routes';
import { validLoginEmail, validLoginPassword } from '../src/mocks/fixtures';

test.describe('login and logout', () => {
  test('logs in with valid credentials and shows the account menu', async ({ page, context }) => {
    await mockAuthMe(page);
    await mockLogin(page, context);

    await page.goto('/login');
    await page.getByPlaceholder('Enter your email').fill(validLoginEmail);
    await page.getByPlaceholder('Enter your password').fill(validLoginPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(0);
  });

  test('shows an error toast on invalid credentials and stays on the page', async ({ page, context }) => {
    await mockAuthMe(page);
    await mockLogin(page, context);

    await page.goto('/login');
    await page.getByPlaceholder('Enter your email').fill(validLoginEmail);
    await page.getByPlaceholder('Enter your password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The mocked 401 uses the API's real error shape ({ defined, code, message }), so the UI shows
    // an error toast. We pin the behaviour (toast + stay on /login), not the exact copy.
    await expect(page.locator('.bg-red-500')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('logs out and returns to the login page', async ({ page, context }) => {
    await mockAuthMe(page);
    await mockLogin(page, context);
    await mockLogout(page, context);

    await page.goto('/login');
    await page.getByPlaceholder('Enter your email').fill(validLoginEmail);
    await page.getByPlaceholder('Enter your password').fill(validLoginPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page).toHaveURL('/login');
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'access_token')).toBeUndefined();
  });
});

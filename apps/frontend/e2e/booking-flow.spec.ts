import { test, expect } from '@playwright/test';
import { mockAuthMe, mockEventDetail, mockCreateBooking, mockBookingDetail, loginAsRole } from './support/mock-routes';
import { mockEvent, mockBooking } from '../src/mocks/fixtures';

/**
 * This covers the flow through to the checkout page rendering the correct
 * order summary. It intentionally stops there: completing a real payment
 * needs Stripe's own test-mode iframe, which isn't something to fake via
 * page.route (Stripe Elements loads from stripe.com, not our API).
 */
test.describe('booking flow', () => {
  test('creates a booking and lands on checkout with the right order summary', async ({
    page,
    context,
  }) => {
    // Keep this suite fully hermetic - Stripe.js itself isn't something to
    // mock meaningfully, so block it outright rather than let a real
    // external request to js.stripe.com slow down or flake the test. The
    // order summary block doesn't depend on Stripe having loaded.
    await page.route('https://js.stripe.com/**', (route) => route.abort());

    await mockAuthMe(page);
    await mockEventDetail(page);
    await mockCreateBooking(page);
    await mockBookingDetail(page);
    await loginAsRole(context, 'CUSTOMER');

    await page.goto(`/events/${mockEvent.id}`);

    await page.getByLabel('First Name').fill('Casey');
    await page.getByLabel('Last Name').fill('Customer');
    await page.getByLabel('Email').fill('customer@eventeer.com');
    await page.getByLabel('Quantity').fill(String(mockBooking.quantity));

    await page.getByRole('button', { name: 'Proceed to Payment' }).click();

    await expect(page).toHaveURL(`/checkout/${mockBooking.id}`);
    await expect(page.getByText(`${mockBooking.quantity} ticket(s)`)).toBeVisible();
    await expect(page.getByText(`$${mockBooking.finalAmount.toFixed(2)}`).first()).toBeVisible();
  });

  test('redirects to login when trying to book while logged out', async ({ page }) => {
    await mockAuthMe(page);
    await mockEventDetail(page);

    await page.goto(`/events/${mockEvent.id}`);

    await expect(page.getByRole('button', { name: 'Proceed to Payment' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'login' })).toBeVisible();
  });
});

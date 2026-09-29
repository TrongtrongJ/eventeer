import { z } from 'zod';

// NEXT_PUBLIC_* vars are inlined at build time and readable in the browser.
// Server-only vars (no NEXT_PUBLIC_ prefix) are only read on the server.
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default('http://localhost:4000'),
  NEXT_PUBLIC_WS_URL: z.url().default('http://localhost:4000'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default(''),
});

const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});

export const apiUrl = env.NEXT_PUBLIC_API_URL;
export const webSocketUrl = env.NEXT_PUBLIC_WS_URL;
export const stripePublishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/**
 * Each oRPC contract maps 1:1 to a NestJS controller prefix
 * (see apps/backend/src/**\/*.controller.ts -> @Controller('<prefix>')).
 * OpenAPILink resolves a procedure's final URL as `${base}${contract meta path}`.
 */
export const domainBaseUrl = {
  auth: `${apiUrl}/auth`,
  events: `${apiUrl}/events`,
  bookings: `${apiUrl}/bookings`,
  coupons: `${apiUrl}/coupons`,
  tickets: `${apiUrl}/tickets`,
} as const;

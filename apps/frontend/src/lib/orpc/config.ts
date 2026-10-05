import { z } from 'zod';

// NEXT_PUBLIC_* vars are inlined at build time and readable in the browser.
// Server-only vars (no NEXT_PUBLIC_ prefix) are only read on the server.
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default('http://localhost:4000'),
  NEXT_PUBLIC_WS_URL: z.url().default('http://localhost:4000'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default(''),
  /** How the Next.js *server* reaches the API (e.g. http://backend:4000 inside Docker/k8s). */
  API_INTERNAL_URL: z.url().optional(),
});

const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  API_INTERNAL_URL: process.env.API_INTERNAL_URL || undefined,
});

/** Public URL: what the BROWSER calls. Cookies are set for this host by the API. */
export const apiUrl = env.NEXT_PUBLIC_API_URL;
export const webSocketUrl = env.NEXT_PUBLIC_WS_URL;
export const stripePublishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/** Server-side calls (RSC, middleware) may use a private network address instead. */
export const serverApiUrl = env.API_INTERNAL_URL ?? env.NEXT_PUBLIC_API_URL;

const domains = ['auth', 'events', 'bookings', 'coupons', 'tickets'] as const;
const withBase = (base: string) => Object.fromEntries(domains.map((d) => [d, `${base}/${d}`])) as Record<(typeof domains)[number], string>;

/**
 * Each oRPC contract maps 1:1 to a NestJS controller prefix
 * (apps/backend/src/**\/*.controller.ts -> @Controller('<prefix>')).
 */
export const domainBaseUrl = withBase(apiUrl);
export const serverDomainBaseUrl = withBase(serverApiUrl);

import { z } from 'zod';

const envSchema = z.object({
  VITE_APP_TITLE: z.string(),
  VITE_REACT_APP_API_URL: z.string().url().optional(),
  VITE_REACT_APP_WS_URL: z.string().url().optional(),
  VITE_REACT_APP_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
})

// validates env and throws useful errors if needed.
const ENV = envSchema.parse(import.meta.env);
export const apiUrl = ENV.VITE_REACT_APP_API_URL || 'http://localhost:4000'
export const webSocketUrl = ENV.VITE_REACT_APP_WS_URL || 'http://localhost:4000'
export const stripePublishableKey = ENV.VITE_REACT_APP_STRIPE_PUBLISHABLE_KEY || ''

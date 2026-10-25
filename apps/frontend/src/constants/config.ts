import { z } from "zod";

const envSchema = z.object({
    NEXT_APP_TITLE: z.string().optional(),
    NEXT_PUBLIC_API_URL: z.url().optional(),
    NEXT_PUBLIC_WS_URL: z.url().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

// validates env and throws useful errors if needed.
const ENV = envSchema.parse(process.env);
export const apiUrl = ENV.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export const webSocketUrl = ENV.NEXT_PUBLIC_WS_URL || "http://localhost:4000";
export const stripePublishableKey = ENV.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

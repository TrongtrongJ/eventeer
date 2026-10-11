"use client";

import { useZodLocale } from "@/i18n/validation";

/** Keeps zod's default validation messages in the active language. Renders nothing. */
export function ZodLocale() {
    useZodLocale();
    return null;
}

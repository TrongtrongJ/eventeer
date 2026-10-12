import { useCallback, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";

/**
 * `@packages/shared-schemas` is shared with the API, so its hard-coded English messages stay as they
 * are. These are the ones the UI can actually surface; anything else falls through unchanged.
 */
const CUSTOM_MESSAGE_KEYS = {
    "Password too short": "passwordTooShort",
    "Password too long": "passwordTooLong",
    "Passwords don't match": "passwordsDontMatch",
    "Password must be at least 8 characters": "passwordMin8",
    "Password must contain at least one uppercase letter, one lowercase letter, and one number": "passwordComplexity",
    "Must be a valid email address": "invalidEmail",
    "The email is too long": "emailTooLong",
    "Discount percentage cannot be 0%": "discountPercentZero",
    "Discount percentage cannot exceed 100%": "discountPercentMax",
    "Discount amount cannot be 0": "discountAmountZero",
    "Discount amount cannot exceed ticket price": "discountExceedsPrice",
} as const;

type CustomKey = (typeof CUSTOM_MESSAGE_KEYS)[keyof typeof CUSTOM_MESSAGE_KEYS];

/** Translates a zod issue message coming out of a shared schema. */
export function useValidationMessage() {
    const t = useTranslations("Validation.custom");
    return useCallback(
        (message: string | undefined) => {
            if (!message) return "";
            const key = (CUSTOM_MESSAGE_KEYS as Record<string, CustomKey | undefined>)[message];
            return key ? t(key) : message;
        },
        [t],
    );
}

/**
 * zod's *default* messages ("Too small: expected string to have >=8 characters") are localised
 * globally. Render <ZodLocale /> once, inside the intl provider.
 *
 * Done in an effect on purpose: `z.config` is process-global, and validation only ever runs in the
 * browser (form handlers), so it must never be toggled by server renders shared across requests.
 */
export function useZodLocale() {
    const locale = useLocale();
    useEffect(() => {
        z.config(locale === "th" ? z.locales.th() : z.locales.en());
    }, [locale]);
}

export const locales = ["en", "th"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Cookie that stores the visitor's explicit choice. `NEXT_LOCALE` is next-intl's own convention. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Pinned on purpose. Without it next-intl falls back to the *server's* time zone, so event times
 * would shift with wherever the container happens to run (UTC on most clusters).
 */
export const APP_TIME_ZONE = "Asia/Bangkok";

export function isValidLocale(v: unknown): v is Locale {
    return typeof v === "string" && locales.some(l => l === v);
}

/** BCP-47 tag handed to `Intl.*` for each app locale. */
const intlTags: Record<Locale, string> = { en: "en-US", th: "th-TH" };

export function toIntlTag(locale: Locale): string {
    return intlTags[locale];
}

/**
 * First-visit fallback: pick the best supported language from an `Accept-Language` header
 * (`th-TH,th;q=0.9,en;q=0.8`). Only the primary subtag is compared; unknown languages -> default.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
    if (!acceptLanguage) return defaultLocale;

    const ranked = acceptLanguage
        .split(",")
        .map(part => {
            const [tag, ...params] = part.trim().split(";");
            const q = params.map(p => p.trim()).find(p => p.startsWith("q="));
            const weight = q ? Number(q.slice(2)) : 1;
            return {
                primary: tag.trim().toLowerCase().split("-")[0],
                weight: Number.isNaN(weight) ? 0 : weight,
            };
        })
        .filter(entry => entry.weight > 0)
        .sort((a, b) => b.weight - a.weight);

    for (const { primary } of ranked) {
        if (isValidLocale(primary)) return primary;
    }
    return defaultLocale;
}

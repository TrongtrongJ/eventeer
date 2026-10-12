import { defaultLocale, toIntlTag, type Locale } from "../i18n/helper";

export interface MoneyOptions {
    /** Which language's number conventions to use. Defaults to English. */
    locale?: Locale;
    /** Text for a zero amount. Pass the translated word; defaults to English. */
    freeLabel?: string;
}

/** Locale-aware money. Zero renders as "Free", which the old formatPrice silently dropped. */
export function formatMoney(
    amount: number | undefined | null,
    currency = "THB",
    { locale = defaultLocale, freeLabel = "Free" }: MoneyOptions = {},
): string {
    if (amount === undefined || amount === null) return "";
    if (amount === 0) return freeLabel;
    try {
        return new Intl.NumberFormat(toIntlTag(locale), { style: "currency", currency }).format(amount);
    } catch {
        return `${amount.toFixed(2)} ${currency}`;
    }
}

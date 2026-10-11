"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/actions/locale-actions";
import { locales, type Locale } from "@/i18n/helper";

export function LocaleSwitcher() {
    const t = useTranslations("Locale");
    const current = useLocale();
    const [isPending, startTransition] = useTransition();

    const choose = (next: Locale) => {
        if (next === current) return;
        // Setting a cookie inside a Server Action makes Next re-render the current route on the
        // server, so server and client components both pick up the new language without a manual refresh.
        startTransition(() => setLocale(next));
    };

    return (
        <div
            role="group"
            aria-label={t("label")}
            className={`flex items-center text-sm ${isPending ? "opacity-60" : ""}`}
        >
            {locales.map((locale, index) => (
                <span key={locale} className="flex items-center">
                    {index > 0 && (
                        <span aria-hidden="true" className="text-gray-300">
                            |
                        </span>
                    )}
                    <button
                        type="button"
                        lang={locale}
                        aria-pressed={locale === current}
                        disabled={isPending}
                        onClick={() => choose(locale)}
                        className={`px-2 py-1 rounded ${
                            locale === current ? "font-semibold text-indigo-600" : "text-gray-600 hover:text-indigo-600"
                        }`}
                    >
                        {t(`names.${locale}`)}
                    </button>
                </span>
            ))}
        </div>
    );
}

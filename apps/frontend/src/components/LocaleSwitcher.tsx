"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/actions/locale-actions";
import { locales, type Locale } from "@/i18n/helper";
import { cn } from "@/lib/utils";

/** Compact segmented control for the interface language. */
export function LocaleSwitcher({ className }: { className?: string }) {
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
            className={cn("inline-flex items-center rounded-md border bg-card/50 p-0.5 text-xs", isPending && "opacity-60", className)}
        >
            {locales.map(locale => (
                <button
                    key={locale}
                    type="button"
                    lang={locale}
                    aria-pressed={locale === current}
                    disabled={isPending}
                    onClick={() => choose(locale)}
                    className={cn(
                        "rounded-[5px] px-2 py-0.5 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        locale === current
                            ? "bg-accent text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    {t(`names.${locale}`)}
                </button>
            ))}
        </div>
    );
}

"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";

/** `formatMoney` bound to the active language ("Free" / "ฟรี", 1,200.00 / ฿1,200.00). */
export function useMoney() {
    const locale = useLocale();
    const t = useTranslations("Common");
    const freeLabel = t("free");

    return useCallback(
        (amount: number | undefined | null, currency?: string) => formatMoney(amount, currency, { locale, freeLabel }),
        [locale, freeLabel],
    );
}

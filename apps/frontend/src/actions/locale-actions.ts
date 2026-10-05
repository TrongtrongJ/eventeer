"use server";

import { getCookieOptions } from "@packages/shared-schemas";
import { cookies } from "next/headers";
import { defaultOneYearTs } from "./actions.const";
import { locales, type Locale } from '../i18n/routing';


export async function setLocale(locale: Locale) {
    const cookieStore = await cookies();

    if (!locales.includes(locale)) {
        console.error(`Invalid locale provided: ${locale}`);
        return;
    }

    const cookieOptions = getCookieOptions({
        maxAge: defaultOneYearTs,
        httpOnly: false,
    });

    cookieStore.set("NEXT_LOCALE", locale, cookieOptions);
}

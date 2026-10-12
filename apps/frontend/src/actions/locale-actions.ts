"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isValidLocale } from "@/i18n/helper";
import { defaultOneYearTs } from "./actions.const";

export async function setLocale(locale: string) {
    // Server Actions are public POST endpoints: the TypeScript type is not a runtime guarantee.
    if (!isValidLocale(locale)) return;

    (await cookies()).set(LOCALE_COOKIE, locale, {
        path: "/",
        maxAge: defaultOneYearTs,
        sameSite: "lax",
        httpOnly: false, // a UI preference, not a credential
        secure: process.env.NODE_ENV === "production", // `secure` would make Safari drop it on http://localhost
    });
}

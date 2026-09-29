"use server";

import { getCookieOptions } from "@packages/shared-schemas";
import { cookies } from "next/headers";
import { defaultOneYearTs } from "./actions.const";

export async function setLocale(locale: string) {
    const cookieStore = await cookies();

    const cookieOptions = getCookieOptions({
        maxAge: defaultOneYearTs,
        httpOnly: false,
    });

    cookieStore.set("NEXT_LOCALE", locale, cookieOptions);
}

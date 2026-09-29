"use server";

import { cookies } from "next/headers";
import { getCookieOptions } from "@packages/shared-schemas";
import { defaultOneYearTs } from "./actions.const";

const allowedPreferenceKeys = ["theme", "fontSize", "darkMode"] as const;
type PreferenceKey = (typeof allowedPreferenceKeys)[number];

export async function setUiPreference(key: PreferenceKey, value: string) {
    const cookieStore = await cookies();

    if (!allowedPreferenceKeys.includes(key)) {
        console.error(`Invalid key provided: ${key}`);
        return;
    }

    cookieStore.set(
        key,
        value,
        getCookieOptions({
            maxAge: defaultOneYearTs,
            sameSite: "lax",
            httpOnly: false,
        }),
    );
}

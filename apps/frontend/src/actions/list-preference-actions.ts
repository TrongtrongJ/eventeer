"use server";

import { getCookieOptions } from "@packages/shared-schemas";
import { cookies } from "next/headers";

const oneYearMs = 60 * 60 * 24 * 365;

const allowedListName = ["users", "registration"] as const;
type ListName = (typeof allowedListName)[number];

export async function updateItemsPerPage(name: ListName, limit: number) {
    const cookieStore = await cookies();

    if (!allowedListName.includes(name)) {
        console.error(`Invalid list name provided: ${name}`);
        return;
    }

    if (typeof limit !== "number" || limit <= 0 || limit > 100) {
        console.error(`Invalid limit type (must be a number): ${limit}`);
        return;
    }

    const cookieName = `${name}ItemsPerPage`;
    cookieStore.set(
        cookieName,
        String(limit),
        getCookieOptions({
            httpOnly: false,
            maxAge: oneYearMs,
        }),
    );
}

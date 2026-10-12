import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { APP_TIME_ZONE, LOCALE_COOKIE, isValidLocale, negotiateLocale } from "./helper";

/**
 * Cookie-based locale (no `/th/...` URL prefix, so every existing route and redirect keeps working):
 * explicit choice (cookie) -> browser language (Accept-Language) -> default.
 */
export default getRequestConfig(async () => {
    const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
    // The cookie is user-controlled input and ends up in an import path, so it MUST be validated.
    const locale = isValidLocale(cookieLocale)
        ? cookieLocale
        : negotiateLocale((await headers()).get("accept-language"));

    return {
        locale,
        timeZone: APP_TIME_ZONE,
        messages: (await import(`../../messages/${locale}.json`)).default,
    };
});

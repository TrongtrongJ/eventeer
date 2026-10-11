import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@packages/shared-schemas";
import { serverApiUrl } from "@/lib/orpc/config";

// Locale is cookie-based and resolved in src/i18n/request.ts, so this proxy only deals with auth:
// there are no locale-prefixed URLs to rewrite or strip.
const PROTECTED_PREFIXES = ["/checkout", "/booking", "/profile", "/bookings", "/create", "/my-events"];

function isProtected(pathname: string) {
    if (PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))) return true;
    // /events/:id/coupons and /events/:id/coupons/create
    return /^\/events\/[^/]+\/coupons(\/create)?$/.test(pathname);
}

function redirectToLogin(request: NextRequest) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);

    const response = NextResponse.redirect(loginUrl);
    // A refresh cookie that just failed is dead weight; drop it so we stop retrying.
    response.cookies.delete(AUTH_COOKIE.REFRESH);
    return response;
}

/** Cookie header for the *current* request with `updates` merged over it. */
function mergeCookieHeader(request: NextRequest, updates: Map<string, string>) {
    const jar = new Map(request.cookies.getAll().map(c => [c.name, c.value]));
    updates.forEach((value, name) => jar.set(name, value));
    return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

export async function proxy(request: NextRequest) {
    // Not a protected route: nothing to do.
    if (!isProtected(request.nextUrl.pathname)) return NextResponse.next();

    // Fast path: an access cookie is present (the API validates it for real).
    if (request.cookies.has(AUTH_COOKIE.ACCESS)) return NextResponse.next();

    // Token refresh logic
    const refreshToken = request.cookies.get(AUTH_COOKIE.REFRESH)?.value;
    if (!refreshToken) return redirectToLogin(request);

    try {
        const res = await fetch(`${serverApiUrl}/auth/refresh`, {
            method: "POST",
            headers: { cookie: `${AUTH_COOKIE.REFRESH}=${refreshToken}` },
            cache: "no-store",
        });

        if (!res.ok) return redirectToLogin(request);

        const setCookies = res.headers.getSetCookie();
        const fresh = new Map<string, string>();
        for (const line of setCookies) {
            const [pair] = line.split(";");
            const eq = pair.indexOf("=");
            fresh.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
        }

        if (!fresh.size) return NextResponse.next();

        const response = NextResponse.next();

        // Apply new cookies to the response so the browser saves them
        setCookies.forEach(line => response.headers.append("set-cookie", line));

        // Tell Next.js Server Components to see the fresh cookies for the current render.
        // Setting 'x-middleware-request-cookie' modifies the request headers flowing down
        // to the rest of the Next.js rendering pipeline.
        response.headers.set("x-middleware-request-cookie", mergeCookieHeader(request, fresh));

        return response;
    } catch {
        return redirectToLogin(request);
    }
}

export const config = {
    // Everything except API routes, Next internals and static files.
    matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

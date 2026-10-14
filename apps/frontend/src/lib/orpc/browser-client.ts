"use client";

import { createORPCClient, type StandardUrl } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi/fetch";
import type { JsonifiedClient } from "@orpc/openapi";
import type { RouterContract, ContractRouterClient } from "@orpc/contract";
import { authContract, bookingContract, couponContract, eventContract, ticketContract } from "@packages/contract";
import { apiUrl, domainBaseUrl } from "./config";

/** Fired when the session can no longer be renewed. Providers listens and sends the user to /login. */
export const SESSION_EXPIRED_EVENT = "auth:session-expired";

/**
 * Auth endpoints must never trigger a refresh-and-retry (it would loop or mask real
 * credential errors). `/auth/me` is the exception: a 401 there usually just means the
 * short-lived access cookie lapsed, which a refresh fixes.
 */
function shouldRefreshOn401(url: string): boolean {
    const path = new URL(url, apiUrl).pathname;
    return !path.startsWith("/auth/") || path === "/auth/me";
}

/** localStorage key holding the time (ms) of the last successful refresh, shared by every tab. */
export const LAST_REFRESH_STORAGE_KEY = "auth:lastRefreshAt";
/** Web Locks name that serialises refreshes across tabs. */
export const REFRESH_LOCK_NAME = "auth:refresh";

// Refresh tokens rotate on use, so two refreshes racing on the same cookie look like replay to the
// server. Three layers keep that from happening:
//   1. Single-flight (per tab): N parallel 401s share ONE refresh call.
//   2. Web Locks (cross tab): tabs take turns, so two tabs never refresh at the same instant.
//   3. "Refreshed since I was sent" check: a 401 for a request that left BEFORE the latest refresh
//      (from this tab or another) is stale. The cookies are already fresh, so just replay it.
let inflightRefresh: Promise<boolean> | null = null;
let lastRefreshAtInMemory = 0; // fallback when localStorage is unavailable (SSR, private mode)

function readLastRefreshAt(): number {
    let stored = 0;
    if (typeof window !== "undefined") {
        try {
            stored = Number(window.localStorage.getItem(LAST_REFRESH_STORAGE_KEY)) || 0;
        } catch {
            /* storage blocked: the in-memory value still covers this tab */
        }
    }
    return Math.max(stored, lastRefreshAtInMemory);
}

function markRefreshed(): void {
    const now = Date.now();
    lastRefreshAtInMemory = now;
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(LAST_REFRESH_STORAGE_KEY, String(now));
    } catch {
        /* see readLastRefreshAt */
    }
}

/** Runs `task` while holding the cross-tab refresh lock; plain call where Web Locks is unsupported. */
function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (!locks) return task();
    // `task` never rejects, so a rejection here can only come from the Locks API itself.
    return locks.request(REFRESH_LOCK_NAME, task).catch(() => task());
}

/** `sentAt` is when the failing request was sent; it lets a stale 401 skip the refresh entirely. */
function refreshSession(sentAt: number): Promise<boolean> {
    if (readLastRefreshAt() > sentAt) return Promise.resolve(true);

    inflightRefresh ??= withRefreshLock(async () => {
        // Re-check under the lock: the tab that held it before us may have just refreshed.
        if (readLastRefreshAt() > sentAt) return true;

        const ok = await globalThis
            .fetch(`${apiUrl}/auth/refresh`, { method: "POST", credentials: "include" })
            .then(res => res.ok)
            .catch(() => false);
        if (ok) markRefreshed();
        return ok;
    }).finally(() => {
        inflightRefresh = null;
    });
    return inflightRefresh;
}

/**
 * Cookie auth with silent renewal: send credentials; on a 401, refresh once and replay the
 * request. Tokens never touch JavaScript (they're httpOnly), so there is nothing to attach.
 */
async function browserFetch(request: Request | string, init?: RequestInit): Promise<Response> {
    const url = typeof request === "string" ? request : request.url;
    // A Request body can only be consumed once, so keep a pristine copy for the retry.
    const replay = typeof request === "string" ? request : request.clone();

    const sentAt = Date.now();
    const response = await globalThis.fetch(request, { ...init, credentials: "include" });
    if (response.status !== 401 || !shouldRefreshOn401(url)) return response;

    if (await refreshSession(sentAt)) {
        return globalThis.fetch(replay, { ...init, credentials: "include" });
    }

    if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    return response;
}

function makeLink<T extends Record<any, any>>(contract: T, url: string) {
    return new OpenAPILink(contract as RouterContract, {
        url: url as StandardUrl,
        fetch: browserFetch,
    });
}

export const authClient: JsonifiedClient<ContractRouterClient<typeof authContract>> = createORPCClient(
    makeLink(authContract, domainBaseUrl.auth),
);

export const eventsClient: JsonifiedClient<ContractRouterClient<typeof eventContract>> = createORPCClient(
    makeLink(eventContract, domainBaseUrl.events),
);

export const bookingsClient: JsonifiedClient<ContractRouterClient<typeof bookingContract>> = createORPCClient(
    makeLink(bookingContract, domainBaseUrl.bookings),
);

export const couponsClient: JsonifiedClient<ContractRouterClient<typeof couponContract>> = createORPCClient(
    makeLink(couponContract, domainBaseUrl.coupons),
);

export const ticketsClient: JsonifiedClient<ContractRouterClient<typeof ticketContract>> = createORPCClient(
    makeLink(ticketContract, domainBaseUrl.tickets),
);

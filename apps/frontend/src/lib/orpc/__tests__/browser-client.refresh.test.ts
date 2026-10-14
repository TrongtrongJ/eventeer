import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test-utils/server";
import { apiUrl } from "../config";
import {
    bookingsClient,
    LAST_REFRESH_STORAGE_KEY,
    REFRESH_LOCK_NAME,
    SESSION_EXPIRED_EVENT,
} from "../browser-client";
import { wrapResponse, apiError } from "@/test-utils/response-envelope";

const PROTECTED = `${apiUrl}/bookings/booking/me`;
const REFRESH = `${apiUrl}/auth/refresh`;

/** Protected endpoint that 401s until `refresh` has been called, like an expired access cookie. */
function expiredThenRenewed() {
    const calls = { protected: 0, refresh: 0 };
    let renewed = false;
    server.use(
        http.get(PROTECTED, () => {
            calls.protected++;
            return renewed
                ? HttpResponse.json(wrapResponse([]), { status: 200 })
                : HttpResponse.json(apiError("UNAUTHORIZED", "Authentication required"), { status: 401 });
        }),
        http.post(REFRESH, async () => {
            calls.refresh++;
            await new Promise(r => setTimeout(r, 20)); // keep it in flight so parallel callers overlap
            renewed = true;
            return HttpResponse.json(wrapResponse({}), { status: 200 });
        }),
    );
    return calls;
}

afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "locks");
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describe("browser client: silent session renewal", () => {
    it("on a 401, refreshes once and transparently replays the request", async () => {
        const calls = expiredThenRenewed();

        const result = await bookingsClient.getMyBookings();

        expect(result.data).toEqual([]);
        expect(calls).toEqual({ protected: 2, refresh: 1 }); // original + exactly one replay
    });

    it("shares ONE refresh between parallel 401s (refresh tokens rotate; concurrent use looks like replay)", async () => {
        const calls = expiredThenRenewed();

        await Promise.all([
            bookingsClient.getMyBookings(),
            bookingsClient.getMyBookings(),
            bookingsClient.getMyBookings(),
        ]);

        expect(calls.refresh).toBe(1);
    });

    it("when the refresh fails, surfaces the 401 and announces that the session expired", async () => {
        const onExpired = vi.fn();
        window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
        server.use(
            http.get(PROTECTED, () =>
                HttpResponse.json(apiError("UNAUTHORIZED", "Authentication required"), { status: 401 }),
            ),
            http.post(REFRESH, () => HttpResponse.json(apiError("UNAUTHORIZED", "Refresh failed"), { status: 401 })),
        );

        await expect(bookingsClient.getMyBookings()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
        expect(onExpired).toHaveBeenCalledTimes(1);
        window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    });

    it("never refreshes on a failed login (a wrong password is not an expired session)", async () => {
        let refreshCalls = 0;
        server.use(
            http.post(`${apiUrl}/auth/login`, () =>
                HttpResponse.json(apiError("UNAUTHORIZED", "Invalid email or password"), { status: 401 }),
            ),
            http.post(REFRESH, () => {
                refreshCalls++;
                return HttpResponse.json({}, { status: 200 });
            }),
        );
        const { authClient } = await import("../browser-client");

        await expect(authClient.login({ email: "a@b.com", password: "x" })).rejects.toMatchObject({
            code: "UNAUTHORIZED",
        });
        expect(refreshCalls).toBe(0);
    });

    it("does not refresh again for a stale 401 (request sent before a refresh that already finished)", async () => {
        const calls = { protected: 0, refresh: 0 };
        let renewed = false;
        server.use(
            http.get(PROTECTED, async () => {
                const n = ++calls.protected;
                if (renewed) return HttpResponse.json(wrapResponse([]), { status: 200 });
                // The first request is slow: its 401 lands AFTER the second request's refresh completed.
                if (n === 1) await sleep(80);
                return HttpResponse.json(apiError("UNAUTHORIZED", "Authentication required"), { status: 401 });
            }),
            http.post(REFRESH, async () => {
                calls.refresh++;
                await sleep(10);
                renewed = true;
                return HttpResponse.json(wrapResponse({}), { status: 200 });
            }),
        );

        const slow = bookingsClient.getMyBookings();
        await sleep(10);
        const fast = bookingsClient.getMyBookings();

        await expect(Promise.all([slow, fast])).resolves.toHaveLength(2);
        expect(calls.refresh).toBe(1);
    });

    it("skips the refresh when another tab renewed the session while the request was in flight", async () => {
        let refreshCalls = 0;
        let renewed = false;
        server.use(
            http.get(PROTECTED, () => {
                if (renewed) return HttpResponse.json(wrapResponse([]), { status: 200 });
                // "Another tab" finishes its refresh while this request is on the wire.
                renewed = true;
                window.localStorage.setItem(LAST_REFRESH_STORAGE_KEY, String(Date.now() + 1));
                return HttpResponse.json(apiError("UNAUTHORIZED", "Authentication required"), { status: 401 });
            }),
            http.post(REFRESH, () => {
                refreshCalls++;
                return HttpResponse.json(wrapResponse({}), { status: 200 });
            }),
        );

        const result = await bookingsClient.getMyBookings();

        expect(result.data).toEqual([]);
        expect(refreshCalls).toBe(0);
    });

    it("takes the cross-tab Web Lock once for parallel 401s", async () => {
        const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
        Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
        const calls = expiredThenRenewed();

        await Promise.all([bookingsClient.getMyBookings(), bookingsClient.getMyBookings()]);

        expect(calls.refresh).toBe(1);
        expect(request).toHaveBeenCalledTimes(1);
        expect(request).toHaveBeenCalledWith(REFRESH_LOCK_NAME, expect.any(Function));
    });
});

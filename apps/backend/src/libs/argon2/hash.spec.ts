import { BulkheadFullError } from "@nestjs/resilience";
import { hashPassword, verifyPassword } from "./hash";

describe("password hashing", () => {
    it("hashes and verifies", async () => {
        const h = await hashPassword("Secret123");
        expect(await verifyPassword(h, "Secret123")).toBe(true);
        expect(await verifyPassword(h, "wrong")).toBe(false);
    });

    it("answers a malformed hash with false, not an exception", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        expect(await verifyPassword("not-a-hash", "x")).toBe(false);
        spy.mockRestore();
    });

    it("under overload, extra callers are rejected as BulkheadFullError, never reported as a wrong password", async () => {
        // 2 running + 50 queued fit; the next one is refused at once. Fire far more than that.
        const h = await hashPassword("Secret123");
        const results = await Promise.allSettled(Array.from({ length: 120 }, () => verifyPassword(h, "Secret123")));
        const rejected = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
        expect(rejected.length).toBeGreaterThan(0);
        expect(rejected.every(r => r.reason instanceof BulkheadFullError)).toBe(true);
        // and nobody was told their (correct) password was wrong
        expect(results.filter(r => r.status === "fulfilled" && r.value === false)).toHaveLength(0);
    });
});

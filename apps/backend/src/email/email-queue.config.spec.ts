import { CircuitOpenError } from "@nestjs/resilience";
import { EMAIL_BACKOFF, EMAIL_JOB_OPTIONS, emailBackoff } from "./email-queue.config";

const smtp = (responseCode: number) => Object.assign(new Error("smtp"), { code: "EPROTOCOL", responseCode });

describe("emailBackoff (Bull backoff strategy)", () => {
    it("grows exponentially from 30s for transient failures, within +-20% jitter", () => {
        const near = (ms: number, base: number) => {
            expect(ms).toBeGreaterThanOrEqual(base * 0.8);
            expect(ms).toBeLessThanOrEqual(base * 1.2);
        };
        near(emailBackoff(1, new Error("x")), 30_000);
        near(emailBackoff(2, new Error("x")), 60_000);
        near(emailBackoff(4, new Error("x")), 240_000);
    });

    it("never waits longer than 15 minutes (+jitter)", () => {
        expect(emailBackoff(20, new Error("x"))).toBeLessThanOrEqual(15 * 60_000 * 1.2);
    });

    it("fails immediately (-1) on a permanent rejection, so a bad address is not retried for 15 minutes", () => {
        expect(emailBackoff(1, smtp(550))).toBe(-1);
    });

    it("waits for the breaker when the circuit is open, never less than 5s", () => {
        const wait = emailBackoff(1, new CircuitOpenError("smtp", 40_000));
        expect(wait).toBeGreaterThanOrEqual(40_000);
        expect(wait).toBeLessThanOrEqual(40_000 + 30_000);
        expect(emailBackoff(1, new CircuitOpenError("smtp", 0))).toBeGreaterThanOrEqual(5_000);
    });

    it("does not grow with attempts while the circuit is open (those attempts are refunded)", () => {
        const w1 = emailBackoff(1, new CircuitOpenError("smtp", 10_000));
        const w5 = emailBackoff(5, new CircuitOpenError("smtp", 10_000));
        expect(w5).toBeLessThanOrEqual(10_000 + 30_000);
        expect(w1).toBeLessThanOrEqual(10_000 + 30_000);
    });

    it("always returns a positive delay (0 would mean an immediate retry)", () => {
        for (let i = 1; i < 10; i++) expect(emailBackoff(i, new Error("x"))).toBeGreaterThan(0);
    });
});

describe("EMAIL_JOB_OPTIONS", () => {
    it("uses the registered custom strategy, not Bull's built-in exponential", () => {
        expect(EMAIL_JOB_OPTIONS.backoff).toEqual({ type: EMAIL_BACKOFF });
    });

    it("bounds what failed jobs keep (they contain reset links)", () => {
        expect(EMAIL_JOB_OPTIONS.removeOnFail).toMatchObject({ age: expect.any(Number), count: expect.any(Number) });
    });
});

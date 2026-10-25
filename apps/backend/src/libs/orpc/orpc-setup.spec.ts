import { BadRequestException } from "@nestjs/common";
import { ORPCError } from "@orpc/server";
import { BulkheadFullError, CircuitOpenError, ResilienceTimeoutError } from "@nestjs/resilience";
import { translateNestExceptions } from "./orpc-setup";

const run = (error: unknown, headers = new Headers()) =>
    translateNestExceptions({ next: () => Promise.reject(error), context: { resHeaders: headers } }).catch(e => ({
        e,
        headers,
    }));

describe("translateNestExceptions", () => {
    it("keeps translating Nest HttpExceptions", async () => {
        const { e } = (await run(new BadRequestException("nope"))) as any;
        expect(e).toBeInstanceOf(ORPCError);
        expect(e.code).toBe("BAD_REQUEST");
        expect(e.message).toBe("nope");
    });

    it("an open circuit becomes 503 with Retry-After, not an opaque 500", async () => {
        const { e, headers } = (await run(new CircuitOpenError("stripe", 12_300))) as any;
        expect(e.code).toBe("SERVICE_UNAVAILABLE");
        expect(headers.get("retry-after")).toBe("13");
    });

    it("a full bulkhead becomes 503", async () => {
        const { e } = (await run(new BulkheadFullError("password-hashing", "full"))) as any;
        expect(e.code).toBe("SERVICE_UNAVAILABLE");
    });

    it("a timeout becomes 504", async () => {
        const { e } = (await run(new ResilienceTimeoutError(10_000, "stripe"))) as any;
        expect(e.code).toBe("GATEWAY_TIMEOUT");
    });

    it("leaves unknown errors alone", async () => {
        const boom = new Error("boom");
        const { e } = (await run(boom)) as any;
        expect(e).toBe(boom);
    });

    it("passes successful results through", async () => {
        await expect(translateNestExceptions({ next: async () => 42 })).resolves.toBe(42);
    });
});

import { Test } from "@nestjs/testing";
import { BulkheadPolicy, CircuitBreakerPolicy, ResilienceService } from "@nestjs/resilience";
import { RESILIENCE_PRESET, registerResilienceModule, BULKHEAD } from "./resilience.config";

/**
 * The module validates every preset when the app boots. An invalid one (a count window smaller than
 * minimumCalls, say) crashes the whole API at startup, so this is the cheapest test worth having.
 */
describe("resilience presets", () => {
    let service: ResilienceService;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ imports: [registerResilienceModule()] }).compile();
        await moduleRef.init();
        service = moduleRef.get(ResilienceService);
    });

    it.each(Object.values(RESILIENCE_PRESET))("preset %s is valid and can be built", name => {
        expect(() => service.preset(name)).not.toThrow();
    });

    it("every outbound dependency has its own named circuit breaker", () => {
        for (const name of [
            RESILIENCE_PRESET.STRIPE,
            RESILIENCE_PRESET.SMTP,
            RESILIENCE_PRESET.REDIS_SESSION,
            RESILIENCE_PRESET.OAUTH_GOOGLE,
            RESILIENCE_PRESET.OAUTH_GITHUB,
            RESILIENCE_PRESET.OAUTH_FACEBOOK,
        ]) {
            service.preset(name);
            expect(service.circuitBreaker(name)).toBeInstanceOf(CircuitBreakerPolicy);
        }
        // independent state: tripping Google leaves GitHub closed
        service.circuitBreaker(RESILIENCE_PRESET.OAUTH_GOOGLE).trip();
        expect(service.circuitBreaker(RESILIENCE_PRESET.OAUTH_GOOGLE).state).toBe("open");
        expect(service.circuitBreaker(RESILIENCE_PRESET.OAUTH_GITHUB).state).toBe("closed");
    });

    it("an open Stripe circuit rejects calls without running them", async () => {
        const policy = service.preset(RESILIENCE_PRESET.STRIPE);
        service.circuitBreaker(RESILIENCE_PRESET.STRIPE).trip();
        const fn = vi.fn();
        await expect(policy.execute(fn)).rejects.toMatchObject({ code: "CIRCUIT_OPEN" });
        expect(fn).not.toHaveBeenCalled();
        service.circuitBreaker(RESILIENCE_PRESET.STRIPE).reset();
    });

    it("Stripe: retries a transient failure once, but never a 4xx", async () => {
        const policy = service.preset(RESILIENCE_PRESET.STRIPE);
        const transient = vi
            .fn()
            .mockRejectedValueOnce(Object.assign(new Error("reset"), { type: "StripeConnectionError" }))
            .mockResolvedValue("ok");
        await expect(policy.execute(transient)).resolves.toBe("ok");
        expect(transient).toHaveBeenCalledTimes(2);

        const declined = vi.fn().mockRejectedValue(Object.assign(new Error("declined"), { statusCode: 402 }));
        await expect(policy.execute(declined)).rejects.toThrow("declined");
        expect(declined).toHaveBeenCalledTimes(1);
    });

    it("SMTP: no in-process retry (the queue owns retries) and a rejected recipient does not feed the breaker", async () => {
        const policy = service.preset(RESILIENCE_PRESET.SMTP);
        const breaker = service.circuitBreaker(RESILIENCE_PRESET.SMTP);
        breaker.reset();
        const rejected = vi
            .fn()
            .mockRejectedValue(Object.assign(new Error("no such user"), { code: "EPROTOCOL", responseCode: 550 }));
        for (let i = 0; i < 12; i++) await expect(policy.execute(rejected)).rejects.toThrow();
        expect(rejected).toHaveBeenCalledTimes(12); // exactly one call each
        expect(breaker.state).toBe("closed");

        const down = vi.fn().mockRejectedValue(Object.assign(new Error("refused"), { code: "ECONNECTION" }));
        for (let i = 0; i < 6; i++) await expect(policy.execute(down)).rejects.toThrow();
        expect(breaker.state).toBe("open");
        breaker.reset();
    });

    it("the shared bulkheads are valid options", () => {
        for (const options of Object.values(BULKHEAD)) expect(() => new BulkheadPolicy(options)).not.toThrow();
    });
});

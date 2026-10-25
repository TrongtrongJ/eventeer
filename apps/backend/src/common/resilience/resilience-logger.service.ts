import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { subscribe, unsubscribe } from "node:diagnostics_channel";
import type { ResilienceEvent } from "@nestjs/resilience";

const TYPES = [
    "retry",
    "timeout",
    "circuit-open",
    "circuit-half-open",
    "circuit-closed",
    "bulkhead-rejected",
    "rate-limited",
    "fallback",
] as const;

/**
 * Logs resilience events once, from the diagnostics channels. Those carry the policies created by the module and the
 * ones created with `new` (the Argon2 bulkhead), which ResilienceEvents does not. Rejections of an open circuit are not
 * logged: the opening is, and one line per rejected call would bury it.
 */
@Injectable()
export class ResilienceLogger implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger("Resilience");
    private readonly handler = (message: unknown) => this.log(message as ResilienceEvent);

    onModuleInit() {
        for (const type of TYPES) subscribe(`nestjs:resilience:${type}`, this.handler);
    }

    onModuleDestroy() {
        for (const type of TYPES) unsubscribe(`nestjs:resilience:${type}`, this.handler);
    }

    private log(event: ResilienceEvent) {
        const { type, policy, source } = event;
        switch (event.type) {
            case "circuit-open":
                this.logger.error({ message: "Circuit breaker opened", policy, source, from: event.from });
                break;
            case "circuit-half-open":
            case "circuit-closed":
                this.logger.log({ message: `Circuit breaker ${event.to}`, policy, source });
                break;
            case "bulkhead-rejected":
                this.logger.warn({
                    message: "Bulkhead full",
                    policy,
                    source,
                    reason: event.reason,
                    active: event.active,
                    queued: event.queued,
                });
                break;
            case "timeout":
                this.logger.warn({ message: "Call timed out", policy, source, timeoutMs: event.timeoutMs });
                break;
            case "retry":
                this.logger.warn({
                    message: "Retrying",
                    policy,
                    source,
                    attempt: event.attempt,
                    delayMs: event.delayMs,
                });
                break;
            default:
                this.logger.warn({ message: type, policy, source });
        }
    }
}

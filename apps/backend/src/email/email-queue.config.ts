import type { JobOptions } from "bull";
import { CircuitOpenError } from "@nestjs/resilience";
import { isPermanentSmtpFailure } from "./smtp-errors";

/** Name of the custom Bull backoff strategy registered in bull.config.ts. */
export const EMAIL_BACKOFF = "email-delivery";

/** Delay before retrying a transient failure: 30s, 1m, 2m, 4m, 8m, capped at 15m. */
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 15 * 60_000;

/** A circuit-open rejection never reached SMTP, so wait for the breaker rather than guess. */
const MIN_CIRCUIT_WAIT_MS = 5_000;
const CIRCUIT_SPREAD_MS = 30_000;

/** How long a mail stays worth sending. Aligned with the links inside it. */
export const EMAIL_TTL_MS = {
    BOOKING_CONFIRMATION: 24 * 3_600_000,
    EMAIL_VERIFICATION: 24 * 3_600_000, // the verification link lives 24 h
    PASSWORD_RESET: 3_600_000, // the reset link lives 1 h
} as const;

/**
 * 6 attempts over ~15 minutes for real failures. Attempts rejected by an open circuit are
 * refunded by the processor, so an SMTP outage of any length does not use them up.
 * Failed jobs hold the whole mail (reset links included), so they are kept for a week at most.
 */
export const EMAIL_JOB_OPTIONS: JobOptions = {
    attempts: 6,
    backoff: { type: EMAIL_BACKOFF },
    removeOnComplete: true,
    removeOnFail: { age: 7 * 24 * 3_600, count: 1_000 }, // age is in seconds
    stackTraceLimit: 5, // a long outage re-runs the same job many times; keep Redis bounded
};

const jitter = (ms: number, spread: number) => Math.round(ms * (1 - spread + Math.random() * spread * 2));

/**
 * Bull backoff strategy. Returns the delay in ms, or -1 to fail the job immediately.
 * `attemptsMade` already includes the attempt that just failed.
 */
export function emailBackoff(attemptsMade: number, err?: Error): number {
    if (err instanceof CircuitOpenError) {
        const wait = Math.max(err.retryAfterMs ?? 0, MIN_CIRCUIT_WAIT_MS);
        // Spread the wake-ups so a queue that piled up does not hit the half-open probe all at once.
        return wait + Math.round(Math.random() * CIRCUIT_SPREAD_MS);
    }
    if (isPermanentSmtpFailure(err)) return -1;
    const exponential = Math.min(BASE_DELAY_MS * 2 ** Math.max(attemptsMade - 1, 0), MAX_DELAY_MS);
    return Math.max(jitter(exponential, 0.2), 1);
}

import { ResilienceModule, type BulkheadOptions, type ResiliencePreset } from "@nestjs/resilience";
import { isSmtpOutage } from "../email/smtp-errors";

/**
 * Presets are applied with ResilienceService.preset(name) from inside services. Decorators
 * (@Resilience, @Retry, ...) only work on controllers, resolvers and gateways, so they cannot
 * protect an outbound call such as Stripe or SMTP.
 *
 * Every preset is explicit: there are no module-wide defaults to inherit by accident.
 */
export enum RESILIENCE_PRESET {
    STRIPE = "stripe",
    SMTP = "smtp",
    OAUTH_GOOGLE = "oauth-google",
    OAUTH_GITHUB = "oauth-github",
    OAUTH_FACEBOOK = "oauth-facebook",
    REDIS_SESSION = "redis-session",
}

/**
 * Bulkheads protect a scarce shared resource, not a dependency, so they are named and shared.
 * Used with @Bulkhead(...) on handlers and `new BulkheadPolicy(...)` in plain functions.
 */
export const BULKHEAD = {
    /**
     * Argon2id uses 64 MiB per hash (see libs/argon2/hash.ts). Two at a time keeps the peak at
     * ~128 MiB, which fits the 512 MiB pod limit; a third would risk an OOM kill under a login burst.
     */
    PASSWORD_HASHING: {
        name: "password-hashing",
        maxConcurrent: 2,
        maxQueue: 50,
        queueTimeout: "5s",
    },
    /**
     * Public, unauthenticated and ILIKE '%x%' (no index): the one endpoint that can hold every
     * Postgres connection. Capping it keeps pool slots free for booking transactions.
     */
    EVENT_SEARCH: {
        name: "event-search",
        maxConcurrent: 4,
        maxQueue: 20,
        queueTimeout: "3s",
    },
} as const satisfies Record<string, BulkheadOptions>;

/** The code exchange is single-use, so OAuth calls are never retried: the user just signs in again. */
const oauthPreset = (): ResiliencePreset => ({
    timeout: "5s",
    retry: false,
    circuitBreaker: {
        failureRateThreshold: 50,
        minimumCalls: 5,
        slidingWindow: { type: "count", size: 10 },
        openDuration: "30s",
        halfOpenMaxCalls: 1,
    },
});

export function registerResilienceModule() {
    return ResilienceModule.forRoot({
        presets: {
            /**
             * Every call is safe to repeat: create and refund carry Stripe idempotency keys, the rest
             * are reads or idempotent. The SDK's own retries are off (maxNetworkRetries: 0) so this
             * policy is the only retry layer. Stripe 4xx answers (declines, invalid requests) are
             * client errors and neither retried nor counted by the breaker.
             */
            [RESILIENCE_PRESET.STRIPE]: {
                timeout: "10s",
                retry: { attempts: 2, backoff: { delay: "300ms", maxDelay: "2s" } },
                circuitBreaker: {
                    failureRateThreshold: 50,
                    minimumCalls: 5,
                    slidingWindow: { type: "count", size: 20 },
                    openDuration: "30s",
                    halfOpenMaxCalls: 2,
                },
            },
            /**
             * No retry here on purpose: the Bull queue owns retries (durable, delayed, survives a
             * restart). A retry in the policy would multiply with the queue's and hold the job's
             * lock. Only server-wide failures count; a rejected recipient says nothing about SMTP.
             */
            [RESILIENCE_PRESET.SMTP]: {
                timeout: "15s",
                retry: false,
                circuitBreaker: {
                    failureRateThreshold: 60,
                    minimumCalls: 5,
                    slidingWindow: { type: "count", size: 10 },
                    openDuration: "60s",
                    halfOpenMaxCalls: 1,
                    recordIf: isSmtpOutage,
                },
            },
            // One breaker per provider: Google being down must not block GitHub sign-in.
            [RESILIENCE_PRESET.OAUTH_GOOGLE]: oauthPreset(),
            [RESILIENCE_PRESET.OAUTH_GITHUB]: oauthPreset(),
            [RESILIENCE_PRESET.OAUTH_FACEBOOK]: oauthPreset(),
            /**
             * Auth hot path. Redis is only a read-through cache here, so a slow Redis must cost one
             * fast timeout and then be skipped (Postgres answers), never a retry.
             */
            [RESILIENCE_PRESET.REDIS_SESSION]: {
                timeout: "150ms",
                retry: false,
                circuitBreaker: {
                    failureRateThreshold: 50,
                    minimumCalls: 5,
                    slidingWindow: { type: "count", size: 10 },
                    openDuration: "10s",
                    halfOpenMaxCalls: 1,
                },
            },
        },
    });
}

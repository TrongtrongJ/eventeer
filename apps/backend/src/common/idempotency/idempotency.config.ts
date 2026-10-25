import { IdempotencyModule } from "@nestjs/idempotency";
import type { Request } from "express";
import { RedisIdempotencyStore } from "./redis-idempotency.store";

export function registerIdempotencyModule() {
    return IdempotencyModule.forRoot({
        header: "Idempotency-Key",
        ttl: "24h", // how long a finished result is replayed
        lockTtl: "60s", // only bounds how long a crashed replica can block a key; live handlers renew it
        storeTimeout: "2s", // a stuck Redis fails the request fast instead of hanging it for 10 s
        // Keys are per user: two customers picking the same key never see each other's booking.
        scope: { http: (req: Request & { user?: { userId?: string } }) => req.user?.userId },
    });
}

/** The store registers itself with IdempotencyStorage in its constructor, so it only needs to be a provider. */
export const IDEMPOTENCY_PROVIDERS = [RedisIdempotencyStore];

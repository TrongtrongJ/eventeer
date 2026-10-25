import { Injectable } from "@nestjs/common";
import { InjectRedis } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import {
    IdempotencyStorage,
    type IdempotencyAcquireResult,
    type IdempotencyStore,
    type IdempotencyStoredPayload,
} from "@nestjs/idempotency";

const PREFIX = "idem:";

/**
 * Every operation is one Lua script, so each is atomic across API replicas. Redis expires the keys itself,
 * so an expired lock or record simply does not exist, as the contract requires.
 * Record layout (hash): state = in-flight | completed, owner, fp (fingerprint), response (JSON).
 */
const ACQUIRE = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('HSET', KEYS[1], 'state', 'in-flight', 'owner', ARGV[1], 'fp', ARGV[2])
  redis.call('PEXPIRE', KEYS[1], ARGV[3])
  return {'acquired'}
end
local state = redis.call('HGET', KEYS[1], 'state')
local fp = redis.call('HGET', KEYS[1], 'fp')
if state == 'completed' then
  return {'completed', fp, redis.call('HGET', KEYS[1], 'response')}
end
return {'in-flight', fp}`;

const OWNED = `redis.call('HGET', KEYS[1], 'state') == 'in-flight' and redis.call('HGET', KEYS[1], 'owner') == ARGV[1]`;

const COMPLETE = `
if ${OWNED} then
  redis.call('HSET', KEYS[1], 'state', 'completed', 'response', ARGV[2])
  redis.call('HDEL', KEYS[1], 'owner')
  redis.call('PEXPIRE', KEYS[1], ARGV[3])
  return 1
end
return 0`;

const RELEASE = `
if ${OWNED} then
  redis.call('DEL', KEYS[1])
  return 1
end
return 0`;

const EXTEND = `
if ${OWNED} then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0`;

@Injectable()
export class RedisIdempotencyStore implements IdempotencyStore {
    constructor(
        @InjectRedis() private readonly redis: Redis,
        storage: IdempotencyStorage,
    ) {
        storage.registerSource(this);
    }

    async acquire(key: string, owner: string, fingerprint: string, lockTtl: number): Promise<IdempotencyAcquireResult> {
        const [state, fp, response] = (await this.redis.eval(
            ACQUIRE,
            1,
            PREFIX + key,
            owner,
            fingerprint,
            lockTtl,
        )) as [string, string?, string?];
        if (state === "acquired") return { state };
        if (state === "completed") {
            return { state, fingerprint: fp!, response: JSON.parse(response!) as IdempotencyStoredPayload };
        }
        return { state: "in-flight", fingerprint: fp! };
    }

    async complete(key: string, owner: string, response: IdempotencyStoredPayload, ttl: number): Promise<boolean> {
        return (await this.redis.eval(COMPLETE, 1, PREFIX + key, owner, JSON.stringify(response), ttl)) === 1;
    }

    async release(key: string, owner: string): Promise<boolean> {
        return (await this.redis.eval(RELEASE, 1, PREFIX + key, owner)) === 1;
    }

    async extend(key: string, owner: string, lockTtl: number): Promise<boolean> {
        return (await this.redis.eval(EXTEND, 1, PREFIX + key, owner, lockTtl)) === 1;
    }
}

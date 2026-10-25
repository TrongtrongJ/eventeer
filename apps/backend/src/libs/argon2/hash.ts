import { hash, verify } from "@node-rs/argon2";
import { BulkheadPolicy } from "@nestjs/resilience";
import { BULKHEAD } from "../../config/resilience.config";

/**
 * One bulkhead for every hash and verify in the process (login, register, password reset, the timing
 * equaliser). Argon2id is memory-hard, so what is being protected is memory and the libuv thread pool,
 * and that is shared by all of these callers. Guarding it here, around the hash itself, also means a
 * request holds a slot for the ~100 ms of hashing, not for its whole database round trip.
 *
 * A full bulkhead throws BulkheadFullError, which the API answers with 503 + Retry-After.
 */
const hashing = new BulkheadPolicy(BULKHEAD.PASSWORD_HASHING);

export function hashPassword(plainTextPassword: string) {
    return hashing.execute(() =>
        hash(plainTextPassword, {
            algorithm: 2,
            memoryCost: 65536, // 64 MiB memory cost
            timeCost: 3, // 3 passes
            parallelism: 4, // 4 lanes/threads
        }),
    );
}

export function verifyPassword(storedHash: string, plainTextPassword: string): Promise<boolean> {
    // The bulkhead wraps the try/catch, not the other way round: a rejected call must surface as
    // "busy, retry" (503), never be swallowed below and reported as a wrong password.
    return hashing.execute(async () => {
        try {
            return await verify(storedHash, plainTextPassword);
        } catch (error) {
            console.error(error);
            return false;
        }
    });
}

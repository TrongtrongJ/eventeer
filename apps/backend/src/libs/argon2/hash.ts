import { hash, verify } from "@node-rs/argon2";

export function hashPassword(plainTextPassword: string) {
    return hash(plainTextPassword, {
        algorithm: 2,
        memoryCost: 65536, // 64 MiB memory cost
        timeCost: 3, // 3 passes
        parallelism: 4, // 4 lanes/threads
    });
}
export async function verifyPassword(storedHash: string, plainTextPassword: string) {
    try {
        return await verify(storedHash, plainTextPassword);
    } catch (error) {
        console.error(error);
        return false;
    }
}

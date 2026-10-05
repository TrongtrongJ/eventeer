import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** 256 bits of CSPRNG output, URL/cookie safe. Opaque: carries no claims. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Tokens are high-entropy random values, so a fast unsalted hash is correct
 * here (there is no low-entropy secret to brute-force) and lets us look a
 * session up with a single indexed equality match.
 */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

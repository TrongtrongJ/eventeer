/**
 * Money is computed in integer minor units (cents/satang) to avoid float drift
 * (0.1 + 0.2 !== 0.3). Postgres `decimal` columns come back as strings, hence Number().
 */
export const toCents = (amount: number | string): number => Math.round(Number(amount) * 100);
export const fromCents = (cents: number): number => cents / 100;

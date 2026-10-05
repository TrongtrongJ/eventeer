import { fromCents, toCents } from './money';

describe('money', () => {
  it('avoids float drift by working in integer minor units', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(toCents(0.1) + toCents(0.2)).toBe(toCents(0.3));
  });

  it('parses Postgres decimal strings', () => {
    expect(toCents('199.99')).toBe(19999);
    expect(fromCents(19999)).toBe(199.99);
  });
});

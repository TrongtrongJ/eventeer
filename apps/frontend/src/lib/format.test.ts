import { describe, it, expect } from 'vitest';
import { formatMoney } from './format';

describe('formatMoney', () => {
  it('formats using the given currency', () => {
    expect(formatMoney(1200, 'THB')).toContain('1,200.00');
    expect(formatMoney(49.5, 'USD')).toBe('$49.50');
  });

  it('shows zero as "Free" (the old formatter rendered nothing)', () => {
    expect(formatMoney(0, 'THB')).toBe('Free');
  });

  it('returns an empty string when there is no amount, and survives a bad currency code', () => {
    expect(formatMoney(undefined)).toBe('');
    expect(formatMoney(null)).toBe('');
    expect(formatMoney(5, 'NOPE')).toBe('5.00 NOPE');
  });
});

import { describe, it, expect } from 'vitest';
import { canAccess } from '../access-control';

describe('canAccess', () => {
  it('should allow access when no role is required', () => {
    expect(canAccess(undefined)).toBe(true);
    expect(canAccess('CUSTOMER')).toBe(true);
  });

  it('should deny access when a role is required but the user has none', () => {
    expect(canAccess(undefined, 'ADMIN')).toBe(false);
  });

  it('should match a single required role', () => {
    expect(canAccess('ADMIN', 'ADMIN')).toBe(true);
    expect(canAccess('CUSTOMER', 'ADMIN')).toBe(false);
  });

  it('should match against an array of allowed roles', () => {
    expect(canAccess('ORGANIZER', ['ORGANIZER', 'ADMIN'])).toBe(true);
    expect(canAccess('ADMIN', ['ORGANIZER', 'ADMIN'])).toBe(true);
    expect(canAccess('CUSTOMER', ['ORGANIZER', 'ADMIN'])).toBe(false);
  });
});

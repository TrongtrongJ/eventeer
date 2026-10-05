import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CouponsService, normalizeCouponCode } from './coupons.service';
import { DiscountType, type Coupon } from '../entities/coupon.entity';
import { UserRole, } from '../entities/user.entity';
import type { Event } from '../entities/event.entity';

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

const makeEvent = (over: Partial<Event> = {}): Event =>
  ({ id: 'evt-1', organizerId: 'org-1', ticketPrice: 1000, ...over }) as Event;

const makeCoupon = (over: Partial<Coupon> = {}): Coupon =>
  ({
    id: 'cpn-1',
    code: 'EARLY20',
    eventId: 'evt-1',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 20,
    maxUsages: 10,
    currentUsages: 0,
    expiresAt: days(5),
    minPurchaseAmount: undefined,
    isActive: true,
    event: makeEvent(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as Coupon;

describe('CouponsService', () => {
  let coupons: { findOne: any; find: any; exists: any; save: any; create: any };
  let events: { findOne: any };
  let service: CouponsService;

  beforeEach(() => {
    coupons = {
      findOne: vi.fn(),
      find: vi.fn(),
      exists: vi.fn().mockResolvedValue(false),
      create: vi.fn((c) => c),
      save: vi.fn(async (c) => ({ id: 'cpn-new', currentUsages: 0, createdAt: new Date(), updatedAt: new Date(), ...c })),
    };
    events = { findOne: vi.fn().mockResolvedValue(makeEvent()) };
    service = new CouponsService(coupons as any, events as any);
  });

  describe('create', () => {
    const dto = {
      code: ' early20 ', eventId: 'evt-1', discountType: DiscountType.PERCENTAGE, discountValue: 20,
      maxUsages: 10, expiresAt: days(5).toISOString(),
    } as any;

    it('normalises the code (trim + upper-case) so lookups are case-insensitive by construction', async () => {
      const created = await service.create(dto, 'org-1', UserRole.ORGANIZER, 'cid');
      expect(created.code).toBe('EARLY20');
      expect(coupons.exists).toHaveBeenCalledWith({ where: { code: 'EARLY20', eventId: 'evt-1' } });
    });

    it("only lets an organizer manage their OWN event's coupons; admins may manage any", async () => {
      await expect(service.create(dto, 'someone-else', UserRole.ORGANIZER, 'cid')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.create(dto, 'someone-else', UserRole.ADMIN, 'cid')).resolves.toBeDefined();
    });

    it('404s for an unknown event', async () => {
      events.findOne.mockResolvedValue(null);
      await expect(service.create(dto, 'org-1', UserRole.ORGANIZER, 'cid')).rejects.toMatchObject({ status: 404 });
    });

    it('validates a FIXED discount against the REAL ticket price, not the client-supplied one', async () => {
      const fixed = { ...dto, discountType: DiscountType.FIXED, discountValue: 1500, eventTicketPrice: 99999 };
      await expect(service.create(fixed, 'org-1', UserRole.ORGANIZER, 'cid')).rejects.toThrow(/cannot exceed the ticket price/);
    });

    it('rejects an expiry in the past', async () => {
      await expect(service.create({ ...dto, expiresAt: days(-1).toISOString() }, 'org-1', UserRole.ORGANIZER, 'cid')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate code for the same event with a 409', async () => {
      coupons.exists.mockResolvedValue(true);
      await expect(service.create(dto, 'org-1', UserRole.ORGANIZER, 'cid')).rejects.toBeInstanceOf(ConflictException);
      expect(coupons.save).not.toHaveBeenCalled();
    });
  });

  describe('findByCode (public checkout preview)', () => {
    it.each([
      ['unknown code', null],
      ['inactive', makeCoupon({ isActive: false })],
      ['expired', makeCoupon({ expiresAt: days(-1) })],
      ['usage cap reached', makeCoupon({ maxUsages: 5, currentUsages: 5 })],
    ])('does not reveal a coupon that cannot be redeemed: %s', async (_label, coupon) => {
      coupons.findOne.mockResolvedValue(coupon);
      await expect(service.findByCode('early20', 'evt-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('looks the code up normalised and returns a redeemable coupon', async () => {
      coupons.findOne.mockResolvedValue(makeCoupon());
      const dto = await service.findByCode('  early20', 'evt-1');
      expect(coupons.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { code: 'EARLY20', eventId: 'evt-1' } }));
      expect(dto.code).toBe('EARLY20');
      expect(dto.eventTicketPrice).toBe(1000);
    });
  });

  describe('redeem (runs inside the booking transaction)', () => {
    /** manager whose usage-claim UPDATE affects `affected` rows (1 = claimed, 0 = lost the race) */
    const managerFor = (coupon: Coupon | null, affected = 1) => {
      const where = vi.fn();
      const qb: any = { update: () => qb, set: () => qb, where: (...a: unknown[]) => (where(...a), qb), execute: async () => ({ affected }) };
      return { manager: { findOne: vi.fn().mockResolvedValue(coupon), createQueryBuilder: () => qb } as any, where };
    };

    it('20% off 2,400.00 = 480.00 (computed in integer cents)', async () => {
      const { manager } = managerFor(makeCoupon());
      await expect(service.redeem(manager, 'early20', 'evt-1', 240_000)).resolves.toEqual({ code: 'EARLY20', discountCents: 48_000 });
    });

    it('a FIXED discount is converted to cents and never exceeds the total', async () => {
      const fixed = makeCoupon({ discountType: DiscountType.FIXED, discountValue: 500 });
      expect((await service.redeem(managerFor(fixed).manager, 'x', 'evt-1', 240_000)).discountCents).toBe(50_000);
      expect((await service.redeem(managerFor(fixed).manager, 'x', 'evt-1', 30_000)).discountCents).toBe(30_000); // capped
    });

    it('a 100% coupon discounts exactly the total', async () => {
      const free = makeCoupon({ discountValue: 100 });
      expect((await service.redeem(managerFor(free).manager, 'x', 'evt-1', 123_456)).discountCents).toBe(123_456);
    });

    it('claims usage with ONE conditional UPDATE that re-checks the cap, expiry and active flag', async () => {
      const { manager, where } = managerFor(makeCoupon());
      await service.redeem(manager, 'early20', 'evt-1', 100_000);
      const clause = where.mock.calls[0][0] as string;
      expect(clause).toContain('"currentUsages" < "maxUsages"');
      expect(clause).toContain('"expiresAt" > now()');
      expect(clause).toContain('"isActive" = true');
    });

    it('loses gracefully when a concurrent redemption took the last use (UPDATE affects 0 rows)', async () => {
      const { manager } = managerFor(makeCoupon({ maxUsages: 1, currentUsages: 0 }), 0);
      await expect(service.redeem(manager, 'early20', 'evt-1', 100_000)).rejects.toThrow(/usage limit/);
    });

    it.each([
      ['unknown', null],
      ['inactive', makeCoupon({ isActive: false })],
      ['expired', makeCoupon({ expiresAt: days(-1) })],
      ['exhausted', makeCoupon({ maxUsages: 3, currentUsages: 3 })],
    ])('rejects a %s coupon without touching usage', async (_label, coupon) => {
      const { manager, where } = managerFor(coupon);
      await expect(service.redeem(manager, 'early20', 'evt-1', 100_000)).rejects.toThrow(/Invalid or expired coupon/);
      expect(where).not.toHaveBeenCalled();
    });

    it('enforces the minimum purchase amount', async () => {
      const { manager, where } = managerFor(makeCoupon({ minPurchaseAmount: 2000 }));
      await expect(service.redeem(manager, 'early20', 'evt-1', 150_000)).rejects.toThrow(/minimum purchase of 2000\.00/);
      expect(where).not.toHaveBeenCalled();
      await expect(service.redeem(managerFor(makeCoupon({ minPurchaseAmount: 2000 })).manager, 'early20', 'evt-1', 200_000)).resolves.toBeDefined();
    });
  });

  describe('release', () => {
    it('gives a usage back but never below zero', async () => {
      const set = vi.fn();
      const qb: any = { update: () => qb, set: (v: any) => (set(v), qb), where: () => qb, execute: async () => ({}) };
      await service.release({ createQueryBuilder: () => qb } as any, ' early20', 'evt-1');
      expect(set.mock.calls[0][0].currentUsages()).toBe('GREATEST(0, "currentUsages" - 1)');
    });
  });

  describe('update', () => {
    it('lets only the event owner (or an admin) toggle a coupon', async () => {
      coupons.findOne.mockResolvedValue(makeCoupon());
      await expect(service.update('cpn-1', { isActive: false }, 'intruder', UserRole.ORGANIZER, 'cid')).rejects.toBeInstanceOf(ForbiddenException);
      const dto = await service.update('cpn-1', { isActive: false }, 'org-1', UserRole.ORGANIZER, 'cid');
      expect(dto.isActive).toBe(false);
    });
  });
});

describe('normalizeCouponCode', () => {
  it('trims and upper-cases', () => expect(normalizeCouponCode('  dev500 ')).toBe('DEV500'));
});

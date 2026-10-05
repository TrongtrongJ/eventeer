import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingStatus } from '../entities/booking.entity';
import { UserRole } from '../entities/user.entity';

const HOLD_MINUTES = 15;
const owner = { userId: 'u-1', role: UserRole.CUSTOMER };
const stranger = { userId: 'u-2', role: UserRole.CUSTOMER };
const admin = { userId: 'u-3', role: UserRole.ADMIN };
const past = () => new Date(Date.now() - 60_000);
const future = () => new Date(Date.now() + 3_600_000);

const dto = { eventId: 'evt-1', quantity: 3, firstName: 'A', lastName: 'B', email: 'a@b.com' } as any;
const reserved = { id: 'evt-1', title: 'Rock Night', ticketPrice: '1000.00', currency: 'THB', capacity: 100, availableSeats: 97 };

describe('BookingsService', () => {
  let bookings: Map<string, any>;
  let tickets: any[];
  let event: any;
  let repo: any;
  let manager: any;
  let events: any;
  let coupons: any;
  let payments: any;
  let email: any;
  let service: BookingsService;
  let seq: number;

  /** A booking already in the store, PENDING with a live hold by default. */
  const seed = (over: Record<string, unknown> = {}) => {
    const b = {
      id: 'b-1', eventId: 'evt-1', userId: 'u-1', quantity: 2, email: 'a@b.com', firstName: 'A', lastName: 'B',
      totalAmount: 2000, finalAmount: 2000, discount: 0, couponCode: undefined,
      status: BookingStatus.PENDING, paymentIntentId: 'pi_1', clientSecret: 'secret_1', expiresAt: future(),
      createdAt: new Date(), updatedAt: new Date(), ...over,
    };
    bookings.set(b.id as string, b);
    return b as any;
  };

  beforeEach(() => {
    seq = 0;
    bookings = new Map();
    tickets = [];
    event = { id: 'evt-1', title: 'Rock Night', currency: 'THB', location: 'Bangkok', startDate: future(), organizerId: 'org-1' };

    repo = {
      findOne: vi.fn(async ({ where }: any) => {
        const b = [...bookings.values()].find((x) => (where.id ? x.id === where.id : x.paymentIntentId === where.paymentIntentId));
        return b ? { ...b, tickets: tickets.filter((t) => t.bookingId === b.id), event } : null;
      }),
      find: vi.fn(async () => [...bookings.values()].filter((b) => b.status === BookingStatus.PENDING && b.expiresAt < new Date())),
      update: vi.fn(async (id: string, patch: any) => Object.assign(bookings.get(id), patch)),
    };

    // Transaction manager: honours the conditional-UPDATE semantics the service relies on.
    manager = {
      create: (_entity: unknown, data: any) => ({ ...data }),
      save: vi.fn(async (x: any) => {
        if (Array.isArray(x)) return tickets.push(...x.map((t, i) => ({ id: `t-${tickets.length + i}`, ...t }))), x;
        const saved = { id: `b-${++seq}`, createdAt: new Date(), updatedAt: new Date(), ...x };
        bookings.set(saved.id, saved);
        return saved;
      }),
      update: vi.fn(async (_entity: unknown, criteria: any, patch: any) => {
        const b = bookings.get(criteria.id);
        const allowed = Array.isArray(criteria.status?.value) ? criteria.status.value : [criteria.status];
        if (!b || !allowed.includes(b.status)) return { affected: 0 };
        Object.assign(b, patch);
        return { affected: 1 };
      }),
      findOneByOrFail: vi.fn(async (_entity: unknown, { id }: any) => bookings.get(id)),
    };

    events = {
      reserveSeats: vi.fn().mockResolvedValue(reserved),
      releaseSeats: vi.fn(),
      broadcastSeatsFor: vi.fn(),
      findOne: vi.fn().mockResolvedValue({ id: 'evt-1', organizerId: 'org-1' }),
    };
    coupons = { redeem: vi.fn(), release: vi.fn() };
    payments = {
      isMock: false,
      createPaymentIntent: vi.fn().mockResolvedValue({ id: 'pi_new', clientSecret: 'secret_new' }),
      getPaymentStatus: vi.fn().mockResolvedValue({ status: 'succeeded', amountCents: 200_000 }),
      cancelPaymentIntent: vi.fn(),
      refund: vi.fn(),
    };
    email = { queueBookingConfirmation: vi.fn() };
    const dataSource = { transaction: (cb: any) => cb(manager) };
    const config = { get: vi.fn(() => HOLD_MINUTES) };

    service = new BookingsService(repo, events, coupons, payments, email, dataSource as any, config as any);
  });

  describe('create', () => {
    it('prices server-side in cents, holds the seats, and opens a payment for the right amount', async () => {
      const result = await service.create(dto, 'u-1', 'cid');

      expect(events.reserveSeats).toHaveBeenCalledWith(manager, 'evt-1', 3);
      expect(payments.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 300_000, currency: 'THB' }));
      expect(result).toMatchObject({ status: 'PENDING', totalAmount: 3000, finalAmount: 3000, discount: 0, clientSecret: 'secret_new' });
      // the hold deadline is ~15 minutes out
      const holdMs = new Date(result.expiresAt!).getTime() - Date.now();
      expect(holdMs).toBeGreaterThan((HOLD_MINUTES - 1) * 60_000);
      expect(holdMs).toBeLessThanOrEqual(HOLD_MINUTES * 60_000);
    });

    it('issues NO tickets until payment is confirmed', async () => {
      const result = await service.create(dto, 'u-1', 'cid');
      expect(result.tickets).toEqual([]);
      expect(tickets).toHaveLength(0);
    });

    it('applies a coupon redeemed against the real total, and records the normalised code', async () => {
      coupons.redeem.mockResolvedValue({ code: 'EARLY20', discountCents: 60_000 });

      const result = await service.create({ ...dto, couponCode: 'early20' }, 'u-1', 'cid');

      expect(coupons.redeem).toHaveBeenCalledWith(manager, 'early20', 'evt-1', 300_000);
      expect(result).toMatchObject({ totalAmount: 3000, discount: 600, finalAmount: 2400, couponCode: 'EARLY20' });
      expect(payments.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 240_000 }));
    });

    it('a fully discounted booking is confirmed immediately: tickets issued, email queued, no payment intent', async () => {
      coupons.redeem.mockResolvedValue({ code: 'FREE', discountCents: 300_000 });

      const result = await service.create({ ...dto, couponCode: 'free' }, 'u-1', 'cid');

      expect(result).toMatchObject({ status: 'CONFIRMED', finalAmount: 0, expiresAt: null });
      expect(result.clientSecret).toBeUndefined();
      expect(result.tickets).toHaveLength(3);
      expect(payments.createPaymentIntent).not.toHaveBeenCalled();
      expect(email.queueBookingConfirmation).toHaveBeenCalledTimes(1);
    });

    it('a free event (price 0) needs no payment either', async () => {
      events.reserveSeats.mockResolvedValue({ ...reserved, ticketPrice: '0.00' });
      const result = await service.create(dto, 'u-1', 'cid');
      expect(result.status).toBe('CONFIRMED');
      expect(payments.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('stops before saving anything when seats cannot be reserved', async () => {
      events.reserveSeats.mockRejectedValue(new BadRequestException('This event is sold out'));
      await expect(service.create(dto, 'u-1', 'cid')).rejects.toThrow(/sold out/);
      expect(manager.save).not.toHaveBeenCalled();
      expect(payments.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('stops before saving anything when the coupon is rejected', async () => {
      coupons.redeem.mockRejectedValue(new BadRequestException('Invalid or expired coupon code'));
      await expect(service.create({ ...dto, couponCode: 'nope' }, 'u-1', 'cid')).rejects.toThrow(/coupon/);
      expect(manager.save).not.toHaveBeenCalled();
      expect(payments.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('compensates when the payment provider fails: booking FAILED, seats and coupon usage returned', async () => {
      coupons.redeem.mockResolvedValue({ code: 'EARLY20', discountCents: 60_000 });
      payments.createPaymentIntent.mockRejectedValue(new Error('stripe down'));

      await expect(service.create({ ...dto, couponCode: 'early20' }, 'u-1', 'cid')).rejects.toThrow('stripe down');

      expect([...bookings.values()][0].status).toBe(BookingStatus.FAILED);
      expect(events.releaseSeats).toHaveBeenCalledWith(manager, 'evt-1', 3);
      expect(coupons.release).toHaveBeenCalledWith(manager, 'EARLY20', 'evt-1');
    });
  });

  describe('confirmBooking', () => {
    it('verifies with the provider, then confirms: tickets issued, email sent, hold cleared', async () => {
      seed();
      const result = await service.confirmBooking('b-1', owner, 'cid');

      expect(payments.getPaymentStatus).toHaveBeenCalledWith('pi_1');
      expect(result.status).toBe('CONFIRMED');
      expect(result.tickets).toHaveLength(2);
      expect(result.clientSecret).toBeUndefined();
      expect(bookings.get('b-1')).toMatchObject({ expiresAt: null, clientSecret: null });
      expect(email.queueBookingConfirmation).toHaveBeenCalledTimes(1);
    });

    it('never trusts the client: unpaid or mismatched-amount payments are rejected and nothing changes', async () => {
      seed();
      payments.getPaymentStatus.mockResolvedValue({ status: 'pending', amountCents: 200_000 });
      await expect(service.confirmBooking('b-1', owner, 'cid')).rejects.toThrow(/not completed/);

      payments.getPaymentStatus.mockResolvedValue({ status: 'succeeded', amountCents: 100 });
      await expect(service.confirmBooking('b-1', owner, 'cid')).rejects.toThrow(/does not match/);

      expect(bookings.get('b-1').status).toBe(BookingStatus.PENDING);
      expect(tickets).toHaveLength(0);
    });

    it('mock mode (dev only): the explicit confirm IS the payment, so the provider is not consulted', async () => {
      payments.isMock = true;
      seed();
      const result = await service.confirmBooking('b-1', owner, 'cid');
      expect(result.status).toBe('CONFIRMED');
      expect(payments.getPaymentStatus).not.toHaveBeenCalled();
    });

    it('is idempotent: confirming again changes nothing and does not re-check the provider', async () => {
      seed({ status: BookingStatus.CONFIRMED });
      const result = await service.confirmBooking('b-1', owner, 'cid');
      expect(result.status).toBe('CONFIRMED');
      expect(payments.getPaymentStatus).not.toHaveBeenCalled();
      expect(tickets).toHaveLength(0);
    });

    it.each([BookingStatus.EXPIRED, BookingStatus.CANCELLED, BookingStatus.FAILED])('refuses to confirm a %s booking', async (status) => {
      seed({ status });
      await expect(service.confirmBooking('b-1', owner, 'cid')).rejects.toBeInstanceOf(ConflictException);
    });

    it("hides other users' bookings behind a 404, but lets an admin through", async () => {
      seed();
      await expect(service.confirmBooking('b-1', stranger, 'cid')).rejects.toMatchObject({ status: 404 });
      await expect(service.confirmBooking('b-1', admin, 'cid')).resolves.toBeDefined();
    });
  });

  describe('handlePaymentEvent (Stripe webhook)', () => {
    it('confirms a PENDING booking on payment success', async () => {
      seed();
      await service.handlePaymentEvent({ type: 'succeeded', paymentIntentId: 'pi_1' });
      expect(bookings.get('b-1').status).toBe(BookingStatus.CONFIRMED);
      expect(tickets).toHaveLength(2);
    });

    it('is idempotent under duplicate delivery: tickets and email happen exactly once', async () => {
      seed();
      await service.handlePaymentEvent({ type: 'succeeded', paymentIntentId: 'pi_1' });
      await service.handlePaymentEvent({ type: 'succeeded', paymentIntentId: 'pi_1' });
      expect(tickets).toHaveLength(2);
      expect(email.queueBookingConfirmation).toHaveBeenCalledTimes(1);
      expect(payments.refund).not.toHaveBeenCalled();
    });

    it.each([BookingStatus.EXPIRED, BookingStatus.CANCELLED])('refunds a payment that arrives after the booking was %s', async (status) => {
      seed({ status });
      await service.handlePaymentEvent({ type: 'succeeded', paymentIntentId: 'pi_1' });
      expect(payments.refund).toHaveBeenCalledWith('pi_1');
      expect(bookings.get('b-1').status).toBe(status);
      expect(tickets).toHaveLength(0);
    });

    it('ignores events for unknown payment intents', async () => {
      await expect(service.handlePaymentEvent({ type: 'succeeded', paymentIntentId: 'pi_unknown' })).resolves.toBeUndefined();
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('a canceled intent fails the PENDING booking and returns its seats', async () => {
      seed();
      await service.handlePaymentEvent({ type: 'canceled', paymentIntentId: 'pi_1' });
      expect(bookings.get('b-1').status).toBe(BookingStatus.FAILED);
      expect(events.releaseSeats).toHaveBeenCalledWith(manager, 'evt-1', 2);
    });
  });

  describe('cancelBooking', () => {
    it('cancels a PENDING hold: stops the payment, returns seats and coupon usage, no refund', async () => {
      seed({ couponCode: 'EARLY20' });
      await service.cancelBooking('b-1', owner, 'cid');

      expect(payments.cancelPaymentIntent).toHaveBeenCalledWith('pi_1');
      expect(payments.refund).not.toHaveBeenCalled();
      expect(bookings.get('b-1').status).toBe(BookingStatus.CANCELLED);
      expect(events.releaseSeats).toHaveBeenCalledWith(manager, 'evt-1', 2);
      expect(coupons.release).toHaveBeenCalledWith(manager, 'EARLY20', 'evt-1');
    });

    it('refunds a CONFIRMED paid booking BEFORE releasing anything', async () => {
      seed({ status: BookingStatus.CONFIRMED });
      await service.cancelBooking('b-1', owner, 'cid');

      expect(payments.refund).toHaveBeenCalledWith('pi_1');
      expect(refundOrder(payments.refund, events.releaseSeats)).toBe(true);
      expect(bookings.get('b-1').status).toBe(BookingStatus.CANCELLED);
    });

    it('if the refund fails, nothing is released and the booking stays CONFIRMED', async () => {
      seed({ status: BookingStatus.CONFIRMED });
      payments.refund.mockRejectedValue(new Error('refund failed'));

      await expect(service.cancelBooking('b-1', owner, 'cid')).rejects.toThrow('refund failed');

      expect(bookings.get('b-1').status).toBe(BookingStatus.CONFIRMED);
      expect(events.releaseSeats).not.toHaveBeenCalled();
    });

    it('does not refund a free booking (nothing was charged)', async () => {
      seed({ status: BookingStatus.CONFIRMED, finalAmount: 0, paymentIntentId: undefined });
      await service.cancelBooking('b-1', owner, 'cid');
      expect(payments.refund).not.toHaveBeenCalled();
      expect(bookings.get('b-1').status).toBe(BookingStatus.CANCELLED);
    });

    it('refuses to cancel a confirmed booking once the event has started', async () => {
      event.startDate = past();
      seed({ status: BookingStatus.CONFIRMED });
      await expect(service.cancelBooking('b-1', owner, 'cid')).rejects.toBeInstanceOf(BadRequestException);
      expect(payments.refund).not.toHaveBeenCalled();
    });

    it.each([BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.FAILED])('refuses to cancel an already-%s booking', async (status) => {
      seed({ status });
      await expect(service.cancelBooking('b-1', owner, 'cid')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('expireStaleHolds (maintenance job)', () => {
    it('expires an unpaid hold: cancels the intent, returns the seats, counts it', async () => {
      seed({ expiresAt: past() });
      payments.getPaymentStatus.mockResolvedValue({ status: 'pending', amountCents: 200_000 });

      expect(await service.expireStaleHolds()).toBe(1);

      expect(payments.cancelPaymentIntent).toHaveBeenCalledWith('pi_1');
      expect(bookings.get('b-1').status).toBe(BookingStatus.EXPIRED);
      expect(events.releaseSeats).toHaveBeenCalledWith(manager, 'evt-1', 2);
    });

    it('confirms instead of expiring when the customer paid just in time', async () => {
      seed({ expiresAt: past() });
      payments.getPaymentStatus.mockResolvedValue({ status: 'succeeded', amountCents: 200_000 });

      expect(await service.expireStaleHolds()).toBe(0);

      expect(bookings.get('b-1').status).toBe(BookingStatus.CONFIRMED);
      expect(events.releaseSeats).not.toHaveBeenCalled();
    });

    it('leaves a still-processing payment alone for the next run', async () => {
      seed({ expiresAt: past() });
      payments.getPaymentStatus.mockResolvedValue({ status: 'processing', amountCents: 200_000 });

      expect(await service.expireStaleHolds()).toBe(0);

      expect(bookings.get('b-1').status).toBe(BookingStatus.PENDING);
      expect(payments.cancelPaymentIntent).not.toHaveBeenCalled();
    });

    it('never touches holds that have not lapsed', async () => {
      seed({ expiresAt: future() });
      expect(await service.expireStaleHolds()).toBe(0);
      expect(events.releaseSeats).not.toHaveBeenCalled();
    });

    it('releases seats only once even if the job overlaps itself', async () => {
      seed({ expiresAt: past() });
      payments.getPaymentStatus.mockResolvedValue({ status: 'pending', amountCents: 200_000 });
      await Promise.all([service.expireStaleHolds(), service.expireStaleHolds()]);
      expect(events.releaseSeats).toHaveBeenCalledTimes(1);
    });

    it('one failing booking does not stop the rest of the batch', async () => {
      seed({ id: 'b-1', paymentIntentId: 'pi_bad', expiresAt: past() });
      seed({ id: 'b-2', paymentIntentId: 'pi_ok', expiresAt: past() });
      payments.getPaymentStatus.mockImplementation(async (id: string) => {
        if (id === 'pi_bad') throw new Error('stripe timeout');
        return { status: 'pending', amountCents: 200_000 };
      });

      expect(await service.expireStaleHolds()).toBe(1);
      expect(bookings.get('b-2').status).toBe(BookingStatus.EXPIRED);
    });
  });

  describe('reads', () => {
    it('shows the Stripe client secret only to the owner of a PENDING booking', async () => {
      seed();
      expect((await service.findOneFor('b-1', owner)).clientSecret).toBe('secret_1');
      expect((await service.findOneFor('b-1', admin)).clientSecret).toBeUndefined();
      await expect(service.findOneFor('b-1', stranger)).rejects.toMatchObject({ status: 404 });
    });

    it('stops showing the secret once the booking is no longer PENDING', async () => {
      seed({ status: BookingStatus.CONFIRMED });
      expect((await service.findOneFor('b-1', owner)).clientSecret).toBeUndefined();
    });

    it('exposes the booking currency from its event', async () => {
      seed();
      expect((await service.findOneFor('b-1', owner)).currency).toBe('THB');
    });

    it("lets only an event's own organizer (or an admin) list its bookings", async () => {
      repo.find.mockResolvedValue([]);
      await expect(service.findByEvent('evt-1', { userId: 'org-9', role: UserRole.ORGANIZER })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.findByEvent('evt-1', { userId: 'org-1', role: UserRole.ORGANIZER })).resolves.toEqual([]);
      await expect(service.findByEvent('evt-1', admin)).resolves.toEqual([]);
    });
  });
});

/** True when the refund call happened before any seat release (call-order check). */
function refundOrder(refund: any, release: any): boolean {
  return refund.mock.invocationCallOrder[0] < release.mock.invocationCallOrder[0];
}

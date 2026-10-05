import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, In, LessThan, Repository } from 'typeorm';
import type { BookingDto, CreateBookingDto } from '@packages/shared-schemas';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { Ticket } from '../entities/ticket.entity';
import { UserRole } from '../entities/user.entity';
import { EventsService } from '../events/events.service';
import { CouponsService } from '../coupons/coupons.service';
import { PaymentEvent, PaymentService } from '../payment/payment.service';
import { EmailService } from '../email/email.service';
import { ResourceNotFoundException } from '../common/exceptions/business.exception';
import { fromCents, toCents } from '../common/money';
import type { EnvConfig } from '../env.validation';

export interface Actor {
  userId: string;
  role: string;
}

const ACTIVE_STATES = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly holdMs: number;

  constructor(
    @InjectRepository(Booking) private readonly bookingRepository: Repository<Booking>,
    private readonly eventsService: EventsService,
    private readonly couponsService: CouponsService,
    private readonly paymentService: PaymentService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
    config: ConfigService<EnvConfig, true>,
  ) {
    this.holdMs = config.get('BOOKING_HOLD_MINUTES', { infer: true }) * 60_000;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  /**
   * 1. ONE transaction: take seats atomically, price server-side, redeem the coupon, insert the booking.
   * 2. After commit: create the payment intent (no network call while holding row locks).
   * 3. If that fails, compensate by releasing everything, so seats are never leaked.
   */
  async create(dto: CreateBookingDto, userId: string, correlationId: string): Promise<BookingDto> {
    const { booking, currency } = await this.dataSource.transaction(async (manager) => {
      const event = await this.eventsService.reserveSeats(manager, dto.eventId, dto.quantity);

      const totalCents = toCents(event.ticketPrice) * dto.quantity;
      let discountCents = 0;
      let couponCode: string | undefined;

      if (dto.couponCode) {
        const redemption = await this.couponsService.redeem(manager, dto.couponCode, dto.eventId, totalCents);
        discountCents = redemption.discountCents;
        couponCode = redemption.code;
      }

      const finalCents = totalCents - discountCents;
      const isFree = finalCents === 0;

      const saved = await manager.save(
        manager.create(Booking, {
          eventId: dto.eventId,
          userId,
          quantity: dto.quantity,
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          totalAmount: fromCents(totalCents),
          discount: fromCents(discountCents),
          finalAmount: fromCents(finalCents),
          couponCode,
          // Free bookings need no payment step: confirm (and issue tickets) immediately.
          status: isFree ? BookingStatus.CONFIRMED : BookingStatus.PENDING,
          expiresAt: isFree ? null : new Date(Date.now() + this.holdMs),
        }),
      );

      if (isFree) await this.issueTickets(manager, saved);
      return { booking: saved, currency: event.currency };
    });

    if (booking.status === BookingStatus.CONFIRMED) {
      await this.eventsService.broadcastSeatsFor(booking.eventId);
      await this.sendConfirmationEmail(booking.id, correlationId);
      return this.toDto(await this.loadOrFail(booking.id), { includeSecret: false });
    }

    try {
      const intent = await this.paymentService.createPaymentIntent({
        amountCents: toCents(booking.finalAmount),
        currency,
        bookingId: booking.id,
        correlationId,
      });
      await this.bookingRepository.update(booking.id, { paymentIntentId: intent.id, clientSecret: intent.clientSecret });
    } catch (err) {
      this.logger.error({ message: 'Payment intent failed; releasing hold', correlationId, bookingId: booking.id });
      await this.release(booking.id, BookingStatus.FAILED);
      throw err;
    }

    await this.eventsService.broadcastSeatsFor(booking.eventId);
    return this.toDto(await this.loadOrFail(booking.id), { includeSecret: true });
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  /**
   * Client-triggered fallback to the webhook. It never trusts the client: payment
   * status and amount are verified with the provider before anything is confirmed.
   */
  async confirmBooking(bookingId: string, actor: Actor, correlationId: string): Promise<BookingDto> {
    const booking = await this.loadOwned(bookingId, actor);

    if (booking.status === BookingStatus.CONFIRMED) return this.toDto(booking, { includeSecret: false });
    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException(`This booking is ${booking.status.toLowerCase()} and can no longer be paid`);
    }
    if (!booking.paymentIntentId) throw new BadRequestException('No payment has been started for this booking');

    // Mock mode (dev only): the explicit confirm call IS the payment. Otherwise verify with the provider.
    if (!this.paymentService.isMock) {
      const payment = await this.paymentService.getPaymentStatus(booking.paymentIntentId);
      if (payment.status !== 'succeeded') throw new BadRequestException('Payment has not completed yet');
      if (payment.amountCents !== toCents(booking.finalAmount)) {
        this.logger.error({ message: 'Payment amount mismatch', correlationId, bookingId });
        throw new BadRequestException('Payment amount does not match the booking');
      }
    }

    await this.finalizePaid(bookingId, correlationId);
    return this.toDto(await this.loadOrFail(bookingId), { includeSecret: false });
  }

  /** Stripe webhook entry point. Idempotent: Stripe retries and may deliver duplicates. */
  async handlePaymentEvent(event: PaymentEvent, correlationId = 'stripe-webhook'): Promise<void> {
    const booking = await this.bookingRepository.findOne({ where: { paymentIntentId: event.paymentIntentId } });
    if (!booking) {
      this.logger.warn({ message: 'Webhook for unknown payment intent', correlationId, intent: event.paymentIntentId });
      return;
    }

    if (event.type === 'succeeded') {
      if (booking.status === BookingStatus.PENDING) {
        await this.finalizePaid(booking.id, correlationId);
      } else if (booking.status !== BookingStatus.CONFIRMED) {
        // Paid after the hold lapsed or the booking was cancelled: give the money back.
        this.logger.error({ message: 'Late payment on inactive booking: refunding', correlationId, bookingId: booking.id });
        await this.paymentService.refund(event.paymentIntentId);
      }
      return;
    }

    if (booking.status === BookingStatus.PENDING) await this.release(booking.id, BookingStatus.FAILED);
  }

  // ── Cancel / expire ───────────────────────────────────────────────────────

  async cancelBooking(bookingId: string, actor: Actor, correlationId: string): Promise<void> {
    const booking = await this.loadOwned(bookingId, actor);

    if (!ACTIVE_STATES.includes(booking.status)) {
      throw new ConflictException(`This booking is already ${booking.status.toLowerCase()}`);
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      if (booking.event.startDate <= new Date()) {
        throw new BadRequestException('Bookings cannot be cancelled after the event has started');
      }
      // Refund FIRST: if it fails we must not release the seats or mark it cancelled.
      if (booking.paymentIntentId && toCents(booking.finalAmount) > 0) {
        await this.paymentService.refund(booking.paymentIntentId);
      }
    } else if (booking.paymentIntentId) {
      await this.paymentService.cancelPaymentIntent(booking.paymentIntentId);
    }

    await this.release(booking.id, BookingStatus.CANCELLED, [booking.status]);
    this.logger.log({ message: 'Booking cancelled', correlationId, bookingId });
  }

  /** Called by the maintenance job for holds whose deadline passed without payment. */
  async expireStaleHolds(limit = 100): Promise<number> {
    const stale = await this.bookingRepository.find({
      where: { status: BookingStatus.PENDING, expiresAt: LessThan(new Date()) },
      order: { expiresAt: 'ASC' },
      take: limit,
    });

    let expired = 0;
    for (const booking of stale) {
      try {
        if (booking.paymentIntentId) {
          const { status } = await this.paymentService.getPaymentStatus(booking.paymentIntentId);
          if (status === 'succeeded') {
            await this.finalizePaid(booking.id, 'expiry-job'); // paid just in time
            continue;
          }
          if (status === 'processing') continue; // bank is still settling: decide next run
          await this.paymentService.cancelPaymentIntent(booking.paymentIntentId);
        }
        if (await this.release(booking.id, BookingStatus.EXPIRED)) expired++;
      } catch (err) {
        this.logger.error(`Failed to expire booking ${booking.id}: ${(err as Error).message}`);
      }
    }
    return expired;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  async findOneFor(id: string, actor: Actor): Promise<BookingDto> {
    const booking = await this.loadOwned(id, actor);
    // The Stripe client secret is only ever shown to the booking's own customer.
    const isOwner = booking.userId === actor.userId;
    return this.toDto(booking, { includeSecret: isOwner && booking.status === BookingStatus.PENDING });
  }

  async findByUser(userId: string): Promise<BookingDto[]> {
    const bookings = await this.bookingRepository.find({
      where: { userId },
      relations: { tickets: true, event: true },
      order: { createdAt: 'DESC' },
    });
    return bookings.map((b) => this.toDto(b, { includeSecret: false }));
  }

  async findAll(): Promise<BookingDto[]> {
    const bookings = await this.bookingRepository.find({ relations: { tickets: true, event: true }, order: { createdAt: 'DESC' } });
    return bookings.map((b) => this.toDto(b, { includeSecret: false }));
  }

  async findByEvent(eventId: string, actor: Actor): Promise<BookingDto[]> {
    const event = await this.eventsService.findOne(eventId);
    if (actor.role !== UserRole.ADMIN && event.organizerId !== actor.userId) {
      throw new ForbiddenException('You can only view bookings for your own events');
    }
    const bookings = await this.bookingRepository.find({
      where: { eventId },
      relations: { tickets: true, event: true },
      order: { createdAt: 'DESC' },
    });
    return bookings.map((b) => this.toDto(b, { includeSecret: false }));
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** PENDING -> CONFIRMED exactly once (conditional UPDATE), then issue tickets + email. */
  private async finalizePaid(bookingId: string, correlationId: string): Promise<void> {
    const confirmed = await this.dataSource.transaction(async (manager) => {
      const res = await manager.update(
        Booking,
        { id: bookingId, status: BookingStatus.PENDING },
        { status: BookingStatus.CONFIRMED, expiresAt: null, clientSecret: null },
      );
      if (res.affected !== 1) return false; // already settled by another path: nothing to do

      const booking = await manager.findOneByOrFail(Booking, { id: bookingId });
      await this.issueTickets(manager, booking);
      return true;
    });

    if (confirmed) await this.sendConfirmationEmail(bookingId, correlationId);
  }

  /**
   * Moves a booking out of an active state and returns its seats and coupon usage,
   * atomically. The conditional UPDATE makes this safe against double execution.
   */
  private async release(
    bookingId: string,
    to: BookingStatus.FAILED | BookingStatus.CANCELLED | BookingStatus.EXPIRED,
    from: BookingStatus[] = [BookingStatus.PENDING],
  ): Promise<boolean> {
    const booking = await this.bookingRepository.findOne({ where: { id: bookingId } });
    if (!booking) return false;

    const released = await this.dataSource.transaction(async (manager) => {
      const res = await manager.update(
        Booking,
        { id: bookingId, status: In(from) },
        { status: to, expiresAt: null, clientSecret: null },
      );
      if (res.affected !== 1) return false;

      await this.eventsService.releaseSeats(manager, booking.eventId, booking.quantity);
      if (booking.couponCode) await this.couponsService.release(manager, booking.couponCode, booking.eventId);
      return true;
    });

    if (released) await this.eventsService.broadcastSeatsFor(booking.eventId);
    return released;
  }

  private async issueTickets(manager: EntityManager, booking: Booking): Promise<void> {
    const tickets = Array.from({ length: booking.quantity }, () =>
      manager.create(Ticket, {
        bookingId: booking.id,
        ticketNumber: `TKT-${randomBytes(5).toString('hex').toUpperCase()}`,
        // 256-bit random: unguessable, so possession of the QR is proof of purchase.
        qrCode: randomBytes(32).toString('hex'),
      }),
    );
    await manager.save(tickets);
  }

  private async sendConfirmationEmail(bookingId: string, correlationId: string): Promise<void> {
    try {
      const booking = await this.bookingRepository.findOne({
        where: { id: bookingId },
        relations: { tickets: true, event: true },
      });
      if (!booking) return;

      await this.emailService.queueBookingConfirmation(
        {
          email: booking.email,
          firstName: booking.firstName,
          lastName: booking.lastName,
          eventTitle: booking.event.title,
          eventDate: booking.event.startDate.toISOString(),
          eventLocation: booking.event.location,
          quantity: booking.quantity,
          totalAmount: Number(booking.finalAmount),
          currency: booking.event.currency,
          bookingId: booking.id,
          qrCodes: booking.tickets.map((t) => ({ ticketNumber: t.ticketNumber, qrCode: t.qrCode })),
        },
        correlationId,
      );
    } catch (err) {
      // The booking is already confirmed; a mail failure must not undo or fail that.
      this.logger.error(`Failed to queue confirmation email for ${bookingId}: ${(err as Error).message}`);
    }
  }

  private async loadOrFail(id: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({ where: { id }, relations: { tickets: true, event: true } });
    if (!booking) throw new ResourceNotFoundException('Booking', id);
    return booking;
  }

  /** Loads a booking and enforces "owner or admin". 404 (not 403) hides other users' booking ids. */
  private async loadOwned(id: string, actor: Actor): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: { tickets: true, event: true },
    });
    if (!booking || (booking.userId !== actor.userId && actor.role !== UserRole.ADMIN)) {
      throw new ResourceNotFoundException('Booking', id);
    }
    return booking;
  }

  private toDto(booking: Booking, opts: { includeSecret: boolean }): BookingDto {
    return {
      id: booking.id,
      eventId: booking.eventId,
      userId: booking.userId ?? undefined,
      quantity: booking.quantity,
      email: booking.email,
      firstName: booking.firstName,
      lastName: booking.lastName,
      couponCode: booking.couponCode ?? undefined,
      currency: booking.event?.currency,
      totalAmount: Number(booking.totalAmount),
      finalAmount: Number(booking.finalAmount),
      discount: Number(booking.discount),
      status: booking.status,
      paymentIntentId: booking.paymentIntentId ?? undefined,
      clientSecret: opts.includeSecret ? (booking.clientSecret ?? undefined) : undefined,
      expiresAt: booking.expiresAt ? booking.expiresAt.toISOString() : null,
      // Tickets only exist (and only count) once the booking is CONFIRMED.
      tickets: (booking.tickets ?? []).map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        qrCode: t.qrCode,
        isValidated: t.isValidated,
        validatedAt: t.validatedAt ? t.validatedAt.toISOString() : null,
      })),
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }
}

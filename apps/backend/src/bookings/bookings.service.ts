import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { Ticket } from '../entities/ticket.entity';
import { Event } from '../entities/event.entity';
import { CreateBookingDto, BookingDto } from '@event-mgmt/shared-schemas';
import { EventsService } from '../events/events.service';
import { CouponsService } from '../coupons/coupons.service';
import { PaymentService } from '../payment/payment.service';
import { EmailService } from '../email/email.service';
import { UserRole } from '../entities/user.entity';
import * as crypto from 'crypto';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly eventsService: EventsService,
    private readonly couponsService: CouponsService,
    private readonly paymentService: PaymentService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createBookingDto: CreateBookingDto,
    userId: string,
    correlationId: string,
  ): Promise<BookingDto> {
    this.logger.log({
      message: 'Creating booking',
      correlationId,
      eventId: createBookingDto.eventId,
      quantity: createBookingDto.quantity,
      userId,
    });

    return await this.dataSource.transaction(async (manager) => {
      // Get event with lock
      const event = await this.eventsService.findOne(createBookingDto.eventId, correlationId);

      if (event.availableSeats < createBookingDto.quantity) {
        throw new BadRequestException('Insufficient available seats');
      }

      // Calculate amounts
      const totalAmount = event.ticketPrice * createBookingDto.quantity;
      let finalAmount = totalAmount;
      let discount = 0;
      let couponCode: string | undefined;

      // Apply coupon if provided
      if (createBookingDto.couponCode) {
        const couponResult = await this.couponsService.validateAndApply(
          {
            code: createBookingDto.couponCode,
            eventId: createBookingDto.eventId,
          },
          totalAmount,
          correlationId,
        );

        if (couponResult.isValid) {
          discount = couponResult.discount;
          finalAmount = couponResult.finalAmount;
          couponCode = createBookingDto.couponCode;
        } else {
          this.logger.warn({
            message: 'Invalid coupon, proceeding without discount',
            correlationId,
            code: createBookingDto.couponCode,
          });
        }
      }

      // Create booking with user association
      const booking = manager.create(Booking, {
        eventId: createBookingDto.eventId,
        userId,
        quantity: createBookingDto.quantity,
        email: createBookingDto.email,
        firstName: createBookingDto.firstName,
        lastName: createBookingDto.lastName,
        totalAmount,
        finalAmount,
        discount,
        couponCode,
        status: BookingStatus.PENDING,
      });

      const savedBooking = await manager.save(Booking, booking);

      // Generate tickets with QR codes
      const tickets: Ticket[] = [];
      for (let i = 0; i < createBookingDto.quantity; i++) {
        const ticketNumber = this.generateTicketNumber();
        const qrCode = this.generateQRCode(savedBooking.id, ticketNumber);

        const ticket = manager.create(Ticket, {
          bookingId: savedBooking.id,
          ticketNumber,
          qrCode,
        });

        tickets.push(ticket);
      }

      await manager.save(Ticket, tickets);

      // Update available seats
      await this.eventsService.updateAvailableSeats(
        createBookingDto.eventId,
        -createBookingDto.quantity,
        correlationId,
        manager,
      );

      // Create payment intent
      try {
        const paymentIntent = await this.paymentService.createPaymentIntent(
          finalAmount,
          event.currency,
          {
            bookingId: savedBooking.id,
            eventId: event.id,
            email: createBookingDto.email,
            userId,
          },
          correlationId,
        );

        savedBooking.paymentIntentId = paymentIntent.paymentIntentId;
        await manager.save(Booking, savedBooking);

        this.logger.log({
          message: 'Booking created with payment intent',
          correlationId,
          bookingId: savedBooking.id,
          paymentIntentId: paymentIntent.paymentIntentId,
          userId,
        });

        // Load booking with tickets for response
        const bookingWithTickets = await manager.findOne(Booking, {
          where: { id: savedBooking.id },
          relations: ['tickets', 'event', 'user'],
        });

        return {
          ...this.toDto(bookingWithTickets!),
          clientSecret: paymentIntent.clientSecret,
        } as any;
      } catch (error) {
        // Rollback seat reservation on payment intent failure
        await this.eventsService.updateAvailableSeats(
          createBookingDto.eventId,
          createBookingDto.quantity,
          correlationId,
          manager,
        );

        if (couponCode) {
          await this.couponsService.revertUsage(
            couponCode,
            createBookingDto.eventId,
            correlationId,
          );
        }

        throw error;
      }
    });
  }

  async confirmBooking(bookingId: string, correlationId: string): Promise<BookingDto> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: ['tickets', 'event', 'user'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.CONFIRMED) {
      return this.toDto(booking);
    }

    // Verify payment
    const isPaymentSuccessful = await this.paymentService.confirmPayment(
      booking.paymentIntentId!,
      correlationId,
    );

    if (!isPaymentSuccessful) {
      throw new BadRequestException('Payment not confirmed');
    }

    booking.status = BookingStatus.CONFIRMED;
    const confirmedBooking = await this.bookingRepository.save(booking);

    // Queue confirmation email
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
        bookingId: booking.id,
        qrCodes: booking.tickets.map((t) => ({
          ticketNumber: t.ticketNumber,
          qrCode: t.qrCode,
        })),
      },
      correlationId,
    );

    this.logger.log({
      message: 'Booking confirmed',
      correlationId,
      bookingId,
      userId: booking.userId,
    });

    return this.toDto(confirmedBooking);
  }

  async findOne(id: string): Promise<BookingDto> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['tickets', 'event', 'user'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.toDto(booking);
  }

  async findByUser(userId: string): Promise<BookingDto[]> {
    const bookings = await this.bookingRepository.find({
      where: { userId },
      relations: ['tickets', 'event'],
      order: { createdAt: 'DESC' },
    });

    return bookings.map((booking) => this.toDto(booking));
  }

  async findAll(): Promise<BookingDto[]> {
    const bookings = await this.bookingRepository.find({
      relations: ['tickets', 'event', 'user'],
      order: { createdAt: 'DESC' },
    });

    return bookings.map((booking) => this.toDto(booking));
  }

  async findByEvent(eventId: string, userId: string, userRole: string): Promise<BookingDto[]> {
    // Verify organizer owns the event (unless admin)
    if (userRole !== UserRole.ADMIN) {
      const event = await this.eventRepository.findOne({ where: { id: eventId } });
      if (!event || event.organizerId !== userId) {
        throw new ForbiddenException('You can only view bookings for your own events');
      }
    }

    const bookings = await this.bookingRepository.find({
      where: { eventId },
      relations: ['tickets', 'user'],
      order: { createdAt: 'DESC' },
    });

    return bookings.map((booking) => this.toDto(booking));
  }
  async cancelBooking(bookingId: string, correlationId: string): Promise<void> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return;
    }

    // Refund if payment was made
    if (booking.paymentIntentId && booking.status === BookingStatus.CONFIRMED) {
      await this.paymentService.refundPayment(
        booking.paymentIntentId,
        Number(booking.finalAmount),
        correlationId,
      );
    }

    // Restore seats
    await this.dataSource.manager.transaction(async (manager) => {
      await this.eventsService.updateAvailableSeats(booking.eventId, booking.quantity, correlationId, manager);
    })
    

    // Revert coupon usage
    if (booking.couponCode) {
      await this.couponsService.revertUsage(booking.couponCode, booking.eventId, correlationId);
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingRepository.save(booking);

    this.logger.log({
      message: 'Booking cancelled',
      correlationId,
      bookingId,
      userId: booking.userId,
    });
  }

  private generateTicketNumber(): string {
    return `TKT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private generateQRCode(bookingId: string, ticketNumber: string): string {
    const data = `${bookingId}:${ticketNumber}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private toDto(booking: Booking): BookingDto {
    return {
      id: booking.id,
      eventId: booking.eventId,
      userId: booking.userId,
      quantity: booking.quantity,
      email: booking.email,
      firstName: booking.firstName,
      lastName: booking.lastName,
      totalAmount: Number(booking.totalAmount),
      finalAmount: Number(booking.finalAmount),
      discount: Number(booking.discount),
      couponCode: booking.couponCode,
      status: booking.status as any,
      paymentIntentId: booking.paymentIntentId,
      tickets: booking.tickets
        ? booking.tickets.map((t) => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            qrCode: t.qrCode,
            isValidated: t.isValidated,
            validatedAt: t.validatedAt?.toISOString() || null,
          }))
        : [],
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }
}

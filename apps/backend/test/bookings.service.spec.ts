import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingsService } from '../src/bookings/bookings.service';
import { Booking, BookingStatus } from '../src/entities/booking.entity';
import { Ticket } from '../src/entities/ticket.entity';
import { Event } from '../src/entities/event.entity';
import { EventsService } from '../src/events/events.service';
import { CouponsService } from '../src/coupons/coupons.service';
import { PaymentService } from '../src/payment/payment.service';
import { EmailService } from '../src/email/email.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingRepository: Repository<Booking>;
  let eventsService: EventsService;
  let couponsService: CouponsService;
  let paymentService: PaymentService;
  let dataSource: DataSource;

  const mockEvent = {
    id: 'event-123',
    title: 'Test Event',
    ticketPrice: 100,
    availableSeats: 50,
    capacity: 100,
    currency: 'USD',
  };

  const mockBooking = {
    id: 'booking-123',
    eventId: 'event-123',
    userId: 'user-123',
    quantity: 2,
    totalAmount: 200,
    finalAmount: 200,
    discount: 0,
    status: BookingStatus.PENDING,
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    tickets: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBookingRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockTicketRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockEventRepository = {
    findOne: jest.fn(),
  };

  const mockEventsService = {
    findOne: jest.fn(),
    updateAvailableSeats: jest.fn(),
  };

  const mockCouponsService = {
    validateAndApply: jest.fn(),
    revertUsage: jest.fn(),
  };

  const mockPaymentService = {
    createPaymentIntent: jest.fn(),
    confirmPayment: jest.fn(),
    refundPayment: jest.fn(),
  };

  const mockEmailService = {
    queueBookingConfirmation: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
    manager: {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getRepositoryToken(Booking),
          useValue: mockBookingRepository,
        },
        {
          provide: getRepositoryToken(Ticket),
          useValue: mockTicketRepository,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: mockEventRepository,
        },
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
        {
          provide: CouponsService,
          useValue: mockCouponsService,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    bookingRepository = module.get<Repository<Booking>>(getRepositoryToken(Booking));
    eventsService = module.get<EventsService>(EventsService);
    couponsService = module.get<CouponsService>(CouponsService);
    paymentService = module.get<PaymentService>(PaymentService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createBookingDto = {
      eventId: 'event-123',
      quantity: 2,
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should create booking successfully', async () => {
      mockEventsService.findOne.mockResolvedValue(mockEvent);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const manager = {
          create: jest.fn((Entity, data) => ({ ...data, id: 'booking-123' })),
          save: jest.fn((Entity, data) => Promise.resolve(data)),
          findOne: jest.fn().mockResolvedValue({ ...mockBooking, tickets: [] }),
        };
        return callback(manager);
      });
      mockEventsService.updateAvailableSeats.mockResolvedValue(undefined);
      mockPaymentService.createPaymentIntent.mockResolvedValue({
        clientSecret: 'secret_123',
        paymentIntentId: 'pi_123',
      });

      const result = await service.create(createBookingDto, 'user-123', 'corr-123');

      expect(result).toHaveProperty('id');
      expect(result.quantity).toBe(2);
      expect(result.totalAmount).toBe(200);
      expect(mockEventsService.updateAvailableSeats).toHaveBeenCalledWith(
        'event-123',
        -2,
        'corr-123',
      );
    });

    it('should throw BadRequestException if insufficient seats', async () => {
      const eventWithFewSeats = { ...mockEvent, availableSeats: 1 };
      mockEventsService.findOne.mockResolvedValue(eventWithFewSeats);

      await expect(
        service.create(createBookingDto, 'user-123', 'corr-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should apply coupon discount if valid coupon provided', async () => {
      const createBookingWithCoupon = {
        ...createBookingDto,
        couponCode: 'SAVE20',
      };

      mockEventsService.findOne.mockResolvedValue(mockEvent);
      mockCouponsService.validateAndApply.mockResolvedValue({
        isValid: true,
        discount: 40,
        finalAmount: 160,
      });
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const manager = {
          create: jest.fn((Entity, data) => ({ ...data, id: 'booking-123' })),
          save: jest.fn((Entity, data) => Promise.resolve(data)),
          findOne: jest.fn().mockResolvedValue({ ...mockBooking, tickets: [] }),
        };
        return callback(manager);
      });
      mockEventsService.updateAvailableSeats.mockResolvedValue(undefined);
      mockPaymentService.createPaymentIntent.mockResolvedValue({
        clientSecret: 'secret_123',
        paymentIntentId: 'pi_123',
      });

      const result = await service.create(createBookingWithCoupon, 'user-123', 'corr-123');

      expect(result.discount).toBe(40);
      expect(result.finalAmount).toBe(160);
      expect(mockCouponsService.validateAndApply).toHaveBeenCalled();
    });

    it('should generate tickets with QR codes', async () => {
      mockEventsService.findOne.mockResolvedValue(mockEvent);
      const tickets = [];
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const manager = {
          create: jest.fn((Entity, data) => {
            if (Entity === Ticket) {
              tickets.push(data);
            }
            return { ...data, id: 'booking-123' };
          }),
          save: jest.fn((Entity, data) => {
            if (Array.isArray(data)) {
              return Promise.resolve(data);
            }
            return Promise.resolve(data);
          }),
          findOne: jest.fn().mockResolvedValue({
            ...mockBooking,
            tickets: [
              { id: 'ticket-1', ticketNumber: 'TKT-1', qrCode: 'qr1' },
              { id: 'ticket-2', ticketNumber: 'TKT-2', qrCode: 'qr2' },
            ],
          }),
        };
        return callback(manager);
      });
      mockEventsService.updateAvailableSeats.mockResolvedValue(undefined);
      mockPaymentService.createPaymentIntent.mockResolvedValue({
        clientSecret: 'secret_123',
        paymentIntentId: 'pi_123',
      });

      const result = await service.create(createBookingDto, 'user-123', 'corr-123');

      expect(tickets).toHaveLength(2);
      expect(tickets[0]).toHaveProperty('ticketNumber');
      expect(tickets[0]).toHaveProperty('qrCode');
    });

    it('should rollback on payment intent failure', async () => {
      mockEventsService.findOne.mockResolvedValue(mockEvent);
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const manager = {
          create: jest.fn((Entity, data) => ({ ...data, id: 'booking-123' })),
          save: jest.fn((Entity, data) => Promise.resolve(data)),
        };
        return callback(manager);
      });
      mockEventsService.updateAvailableSeats.mockResolvedValue(undefined);
      mockPaymentService.createPaymentIntent.mockRejectedValue(
        new Error('Payment service error'),
      );

      await expect(
        service.create(createBookingDto, 'user-123', 'corr-123'),
      ).rejects.toThrow();

      // Should restore seats
      expect(mockEventsService.updateAvailableSeats).toHaveBeenCalledWith(
        'event-123',
        2, // Positive to restore
        'corr-123',
      );
    });
  });

  describe('confirmBooking', () => {
    it('should confirm booking successfully', async () => {
      const bookingWithTickets = {
        ...mockBooking,
        paymentIntentId: 'pi_123',
        event: mockEvent,
        tickets: [
          { ticketNumber: 'TKT-1', qrCode: 'qr1' },
          { ticketNumber: 'TKT-2', qrCode: 'qr2' },
        ],
      };

      mockBookingRepository.findOne.mockResolvedValue(bookingWithTickets);
      mockPaymentService.confirmPayment.mockResolvedValue(true);
      mockBookingRepository.save.mockResolvedValue({
        ...bookingWithTickets,
        status: BookingStatus.CONFIRMED,
      });

      const result = await service.confirmBooking('booking-123', 'corr-123');

      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(mockEmailService.queueBookingConfirmation).toHaveBeenCalled();
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockBookingRepository.findOne.mockResolvedValue(null);

      await expect(service.confirmBooking('non-existent', 'corr-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if payment not confirmed', async () => {
      const bookingWithPayment = {
        ...mockBooking,
        paymentIntentId: 'pi_123',
        event: mockEvent,
        tickets: [],
      };

      mockBookingRepository.findOne.mockResolvedValue(bookingWithPayment);
      mockPaymentService.confirmPayment.mockResolvedValue(false);

      await expect(service.confirmBooking('booking-123', 'corr-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return booking if already confirmed', async () => {
      const confirmedBooking = {
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
        event: mockEvent,
        tickets: [],
      };

      mockBookingRepository.findOne.mockResolvedValue(confirmedBooking);

      const result = await service.confirmBooking('booking-123', 'corr-123');

      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(mockPaymentService.confirmPayment).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return booking by id', async () => {
      mockBookingRepository.findOne.mockResolvedValue(mockBooking);

      const result = await service.findOne('booking-123');

      expect(result.id).toBe('booking-123');
      expect(mockBookingRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'booking-123' },
        relations: ['tickets', 'event', 'user'],
      });
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockBookingRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUser', () => {
    it('should return all bookings for user', async () => {
      const userBookings = [mockBooking, { ...mockBooking, id: 'booking-456' }];
      mockBookingRepository.find.mockResolvedValue(userBookings);

      const result = await service.findByUser('user-123');

      expect(result).toHaveLength(2);
      expect(mockBookingRepository.find).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        relations: ['tickets', 'event'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking and restore seats', async () => {
      mockBookingRepository.findOne.mockResolvedValue(mockBooking);
      mockPaymentService.refundPayment.mockResolvedValue(true);
      mockEventsService.updateAvailableSeats.mockResolvedValue(undefined);
      mockBookingRepository.save.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      });

      await service.cancelBooking('booking-123', 'corr-123');

      expect(mockEventsService.updateAvailableSeats).toHaveBeenCalledWith(
        'event-123',
        2, // Restore seats
        'corr-123',
      );
      expect(mockBookingRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BookingStatus.CANCELLED,
        }),
      );
    });

    it('should refund payment if booking was confirmed', async () => {
      const confirmedBooking = {
        ...mockBooking,
        status: BookingStatus.CONFIRMED,
        paymentIntentId: 'pi_123',
      };

      mockBookingRepository.findOne.mockResolvedValue(confirmedBooking);
      mockPaymentService.refundPayment.mockResolvedValue(true);
      mockEventsService.updateAvailableSeats.mockResolvedValue(undefined);
      mockBookingRepository.save.mockResolvedValue({
        ...confirmedBooking,
        status: BookingStatus.CANCELLED,
      });

      await service.cancelBooking('booking-123', 'corr-123');

      expect(mockPaymentService.refundPayment).toHaveBeenCalledWith(
        'pi_123',
        200,
        'corr-123',
      );
    });

    it('should revert coupon usage if coupon was used', async () => {
      const bookingWithCoupon = {
        ...mockBooking,
        couponCode: 'SAVE20',
      };

      mockBookingRepository.findOne.mockResolvedValue(bookingWithCoupon);
      mockEventsService.updateAvailableSeats.mockResolvedValue(undefined);
      mockCouponsService.revertUsage.mockResolvedValue(undefined);
      mockBookingRepository.save.mockResolvedValue({
        ...bookingWithCoupon,
        status: BookingStatus.CANCELLED,
      });

      await service.cancelBooking('booking-123', 'corr-123');

      expect(mockCouponsService.revertUsage).toHaveBeenCalledWith(
        'SAVE20',
        'event-123',
        'corr-123',
      );
    });

    it('should not throw if booking not found', async () => {
      mockBookingRepository.findOne.mockResolvedValue(null);

      await expect(service.cancelBooking('non-existent', 'corr-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return early if already cancelled', async () => {
      const cancelledBooking = {
        ...mockBooking,
        status: BookingStatus.CANCELLED,
      };

      mockBookingRepository.findOne.mockResolvedValue(cancelledBooking);

      await service.cancelBooking('booking-123', 'corr-123');

      expect(mockPaymentService.refundPayment).not.toHaveBeenCalled();
      expect(mockEventsService.updateAvailableSeats).not.toHaveBeenCalled();
    });
  });
});
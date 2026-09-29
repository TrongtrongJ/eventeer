import { http, HttpResponse } from 'msw';
import type { BookingDto, CreateBookingDto } from '@packages/shared-schemas';
import { server } from '@/test-utils/server';
import { wrapResponse } from '@/test-utils/response-envelope';
import { apiUrl } from '../../config';

export const mockBooking1Id = 'booking-uuid-1';
export const mockEvent1Id = 'event-uuid-1';

export const mockBooking1: BookingDto = {
  id: mockBooking1Id,
  eventId: mockEvent1Id,
  quantity: 2,
  email: 'stewie-griffin@eventeer.com',
  firstName: 'Stewie',
  lastName: 'Griffin',
  couponCode: undefined,
  userId: 'test-user-id-1',
  totalAmount: 1000,
  finalAmount: 1000,
  discount: 0,
  status: 'CONFIRMED',
  paymentIntentId: undefined,
  clientSecret: undefined,
  tickets: [
    {
      id: 'ticket-uuid-1',
      ticketNumber: 'event-1-ticket-001',
      qrCode: 'eventeer.com/confirm/event-1-ticket-001',
      isValidated: true,
      validatedAt: '2026-03-14T20:01:03.225Z',
    },
    {
      id: 'ticket-uuid-2',
      ticketNumber: 'event-1-ticket-002',
      qrCode: 'eventeer.com/confirm/event-1-ticket-002',
      isValidated: true,
      validatedAt: '2026-03-14T21:12:01.556Z',
    },
  ],
  createdAt: '2026-03-10T17:26:54.773Z',
  updatedAt: '2026-03-10T17:26:54.773Z',
};

export const mockBookingNewId = 'booking-uuid-2';
export const mockEvent2Id = 'event-uuid-2';

export const mockNewBooking: BookingDto = {
  id: mockBookingNewId,
  eventId: mockEvent2Id,
  quantity: 2,
  email: 'peter-griffin@eventeer.com',
  firstName: 'Peter',
  lastName: 'Griffin',
  couponCode: undefined,
  userId: 'test-user-id-33',
  totalAmount: 159,
  finalAmount: 159,
  discount: 0,
  status: 'PENDING',
  paymentIntentId: undefined,
  clientSecret: 'pi_test_secret_123',
  tickets: [],
  createdAt: '2026-03-10T17:26:54.773Z',
  updatedAt: '2026-03-10T17:26:54.773Z',
};

export const mockCreateNewBookingData: CreateBookingDto = {
  eventId: mockNewBooking.eventId,
  quantity: mockNewBooking.quantity,
  email: mockNewBooking.email,
  firstName: mockNewBooking.firstName,
  lastName: mockNewBooking.lastName,
  couponCode: mockNewBooking.couponCode,
};

let mockBookingsDb: BookingDto[] = [mockBooking1];

export function resetMockBookingsDb() {
  mockBookingsDb = [mockBooking1];
}

type CallCountState = { callCount: number };

export const bookingsApiMock = {
  useMockMyBookingsList: (callCountState?: CallCountState) =>
    server.use(
      http.get(`${apiUrl}/bookings/booking/me`, () => {
        if (callCountState) callCountState.callCount++;
        return HttpResponse.json(wrapResponse(structuredClone(mockBookingsDb)), { status: 200 });
      }),
    ),

  useMockErrorMyBookingsList: () =>
    server.use(
      http.get(`${apiUrl}/bookings/booking/me`, () =>
        HttpResponse.json({ message: 'Internal server error' }, { status: 500 }),
      ),
    ),

  useMockCreateBooking: () =>
    server.use(
      http.post(`${apiUrl}/bookings/create`, async () =>
        HttpResponse.json(wrapResponse(structuredClone(mockNewBooking)), { status: 201 }),
      ),
    ),

  useMockGetBookingById: (callCountState?: CallCountState) =>
    server.use(
      http.get(`${apiUrl}/bookings/:id`, ({ params }) => {
        const { id } = params;
        if (id === mockBooking1Id) {
          if (callCountState) callCountState.callCount++;
          return HttpResponse.json(wrapResponse(mockBooking1), { status: 200 });
        }
        if (id === mockBookingNewId) {
          return HttpResponse.json(wrapResponse(mockNewBooking), { status: 200 });
        }
        return HttpResponse.json({ message: 'Not found' }, { status: 404 });
      }),
    ),

  useMockCancelBooking: () =>
    server.use(
      http.delete(`${apiUrl}/bookings/:id`, () =>
        HttpResponse.json(wrapResponse(null), { status: 200 }),
      ),
    ),

  /**
   * Stateful mock for the confirm-booking flow: findOne returns PENDING
   * until POST /:id/confirm has been called, then flips to CONFIRMED -
   * this lets a test prove that invalidating after confirmBooking actually
   * causes a refetch that picks up the new status (see CheckoutClient).
   */
  useMockConfirmBookingFlow: () => {
    let isConfirmed = false;
    return server.use(
      http.get(`${apiUrl}/bookings/:id`, ({ params }) => {
        if (params.id !== mockBookingNewId) {
          return HttpResponse.json({ message: 'Not found' }, { status: 404 });
        }
        return HttpResponse.json(
          wrapResponse({ ...mockNewBooking, status: isConfirmed ? 'CONFIRMED' : 'PENDING' }),
          { status: 200 },
        );
      }),
      http.post(`${apiUrl}/bookings/:id/confirm`, ({ params }) => {
        if (params.id !== mockBookingNewId) {
          return HttpResponse.json({ message: 'Not found' }, { status: 404 });
        }
        isConfirmed = true;
        return HttpResponse.json(wrapResponse({ ...mockNewBooking, status: 'CONFIRMED' }), {
          status: 200,
        });
      }),
    );
  },
};

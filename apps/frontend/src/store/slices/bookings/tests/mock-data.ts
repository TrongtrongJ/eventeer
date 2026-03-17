import { http, HttpResponse } from 'msw';
import { BookingDto, CreateBookingDto } from '@event-mgmt/shared-schemas';
import { server } from '../../../../test-utils/server';

export const mockBooking1Id = 'test-booking-1';
export const mockEvent1Id = 'test-event-1';

const mockBooking1: BookingDto = {
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
      id: 'test-ticket-1',
      ticketNumber: 'test-event-1-ticket-001',
      qrCode: 'eventeer.com/confirm/test-event-ticket-001?email=stewie-griffin@eventeer.com',
      isValidated: true,
      validatedAt: "2026-03-14T20:01:03.225Z"
    },
    {
      id: 'test-ticket-2',
      ticketNumber: 'test-event-1-ticket-002',
      qrCode: 'eventeer.com/confirm/test-event-ticket-002?email=stewie-griffin@eventeer.com',
      isValidated: true,
      validatedAt: "2026-03-14T21:12:01.556Z"
    },
  ],
  createdAt: "2026-03-10T17:26:54.773Z",
  updatedAt: "2026-03-10T17:26:54.773Z",
};

export const mockBookingNewId = 'test-booking-2';
export const mockEvent2Id = 'test-event-2';

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
  status: 'CONFIRMED',
  paymentIntentId: undefined,
  clientSecret: undefined,
  tickets: [
    {
      id: 'test-ticket-3',
      ticketNumber: 'test-event-2-ticket-001',
      qrCode: 'eventeer.com/confirm/test-event-2-ticket-001?email=peter-griffin@eventeer.com',
      isValidated: true,
      validatedAt: "2026-03-14T20:01:03.225Z"
    },
  ],
  createdAt: "2026-03-10T17:26:54.773Z",
  updatedAt: "2026-03-10T17:26:54.773Z",
};

export const mockCreateNewBookingData: CreateBookingDto = {
  eventId: mockNewBooking['eventId'],
  quantity: mockNewBooking['quantity'],
  email: mockNewBooking['email'],
  firstName: mockNewBooking['firstName'],
  lastName: mockNewBooking['lastName'],
  couponCode: mockNewBooking['couponCode'],
};

let mockBookingsDb: BookingDto[] = [ mockBooking1 ];

export function resetMockBookingsDb() {
  mockBookingsDb = [ mockBooking1 ];
};

type CallCountState = {
  callCount: number;
};
export const bookingsApiMock = {
  useMockMyBookingsList: (callCountState?: CallCountState) => server.use(http.get(`*/bookings/me`, () => {
    if (callCountState) callCountState.callCount ++;
    return HttpResponse.json(structuredClone(mockBookingsDb), { status: 200 });
  })),
  useMockErrorMyBookingsList: () => server.use(http.get('*/bookings/me', () => {
    return new HttpResponse(null, { status: 500 });
  })),
  useMockCreateBooking: () => server.use(http.post('*/bookings/create', async ({ request }) => {
    return HttpResponse.json(structuredClone(mockNewBooking), { status: 201 });
  })),
  useMockGetBookingById: (callCountState: CallCountState) => server.use(http.get<{id: string}>(`*/bookings/:id`, ({ params }) => {
    const { id } = params;
    switch (id) {
      case mockBooking1Id: 
        callCountState.callCount ++;
        return HttpResponse.json(mockBooking1, { status: 200 })
      case mockBookingNewId: 
        return HttpResponse.json(mockNewBooking, { status: 200 })
      default:
        return new HttpResponse(null, { status: 404 })
    }
  })),
  useMockDeleteBookingById: () => server.use(http.delete<{id: string}>(`*/bookings/:id`, ({ params }) => {
    return new HttpResponse(null, { status: 204 })
  })),
};
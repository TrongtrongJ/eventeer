import type { UserDto, EventDto, BookingDto } from '@packages/shared-schemas';

/**
 * The fake access_token value IS the role - both mock layers (Node-side MSW
 * in instrumentation.ts, and Playwright's page.route in e2e specs) decode
 * the incoming request's `access_token` cookie the same way. This keeps
 * "who is logged in" stateless and consistent across the SSR/browser split,
 * without needing a shared mutable store that parallel tests would stomp on.
 */
export const E2E_TOKENS = {
  CUSTOMER: 'e2e-customer-token',
  ORGANIZER: 'e2e-organizer-token',
  ADMIN: 'e2e-admin-token',
} as const;

export type E2ERole = keyof typeof E2E_TOKENS;

export function userForToken(token: string | undefined): UserDto | null {
  const entry = (Object.entries(E2E_TOKENS) as [E2ERole, string][]).find(([, v]) => v === token);
  if (!entry) return null;
  return mockUsers[entry[0]];
}

export function extractCookieValue(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1];
}

export const mockUsers: Record<E2ERole, UserDto> = {
  CUSTOMER: {
    id: 'e2e-user-customer',
    email: 'customer@eventeer.com',
    firstName: 'Casey',
    lastName: 'Customer',
    avatarUrl: undefined,
    role: 'CUSTOMER',
    provider: 'LOCAL',
    isEmailVerified: true,
    isActive: true,
    lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
  },
  ORGANIZER: {
    id: 'e2e-user-organizer',
    email: 'organizer@eventeer.com',
    firstName: 'Oliver',
    lastName: 'Organizer',
    avatarUrl: undefined,
    role: 'ORGANIZER',
    provider: 'LOCAL',
    isEmailVerified: true,
    isActive: true,
    lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
  },
  ADMIN: {
    id: 'e2e-user-admin',
    email: 'admin@eventeer.com',
    firstName: 'Ada',
    lastName: 'Admin',
    avatarUrl: undefined,
    role: 'ADMIN',
    provider: 'LOCAL',
    isEmailVerified: true,
    isActive: true,
    lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
  },
};

export const validLoginEmail = mockUsers.CUSTOMER.email;
export const validLoginPassword = 'e2e-test-password';

export const mockEvent: EventDto = {
  id: 'e2e-event-1',
  title: 'Bangkok Tech Summit',
  description: 'A gathering of the finest engineers in Bangkok.',
  location: 'Bangkok, Thailand',
  startDate: '2026-12-01T02:00:00.000Z',
  endDate: '2026-12-01T10:00:00.000Z',
  capacity: 500,
  ticketPrice: 599,
  currency: 'THB',
  imageUrl: undefined,
  organizerId: mockUsers.ORGANIZER.id,
  organizerName: 'Oliver Organizer',
  availableSeats: 120,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const mockBooking: BookingDto = {
  id: 'e2e-booking-1',
  eventId: mockEvent.id,
  quantity: 2,
  email: mockUsers.CUSTOMER.email,
  firstName: mockUsers.CUSTOMER.firstName,
  lastName: mockUsers.CUSTOMER.lastName,
  couponCode: undefined,
  userId: mockUsers.CUSTOMER.id,
  totalAmount: 1198,
  finalAmount: 1198,
  discount: 0,
  status: 'PENDING',
  paymentIntentId: 'pi_e2e_test',
  clientSecret: 'pi_e2e_test_secret',
  tickets: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export function wrapResponse<T>(data: T) {
  return {
    success: true,
    data,
    correlationId: 'e2e-correlation-id',
    timestamp: new Date().toISOString(),
  };
}

export function wrapPaginated<T>(items: T[]) {
  return {
    data: items,
    meta: {
      total: items.length,
      page: 1,
      limit: 12,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    links: { first: '?page=1', previous: null, next: null, last: '?page=1' },
    success: true,
    correlationId: 'e2e-correlation-id',
    timestamp: new Date().toISOString(),
  };
}

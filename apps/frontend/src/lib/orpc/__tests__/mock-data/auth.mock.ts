import { http, HttpResponse } from 'msw';
import type { UserDto } from '@packages/shared-schemas';
import { server } from '@/test-utils/server';
import { wrapResponse, apiError } from '@/test-utils/response-envelope';
import { apiUrl } from '../../config';

export const validEmail = 'jane@eventeer.com';
export const validPassword = 'securepass123';

export const mockUser: UserDto = {
  id: '11111111-1111-1111-1111-111111111111',
  email: validEmail,
  firstName: 'Jane',
  lastName: 'Doe',
  avatarUrl: undefined,
  role: 'CUSTOMER',
  provider: 'LOCAL',
  isEmailVerified: true,
  isActive: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
};

// Auth responses carry the user only; tokens live in httpOnly cookies.
export const mockAuthResponse = { user: mockUser };

export const authApiMock = {
  useMockLogin: () =>
    server.use(
      http.post(`${apiUrl}/auth/login`, async ({ request }) => {
        const body = (await request.json()) as { email: string; password: string };
        if (body.email !== validEmail || body.password !== validPassword) {
          return HttpResponse.json(apiError('UNAUTHORIZED', 'Invalid credentials'), { status: 401 });
        }
        return HttpResponse.json(wrapResponse(mockAuthResponse), { status: 200 });
      }),
    ),

  useMockRegister: () =>
    server.use(
      http.post(`${apiUrl}/auth/register`, async ({ request }) => {
        const body = (await request.json()) as { email: string };
        if (body.email === 'taken@eventeer.com') {
          return HttpResponse.json(apiError('CONFLICT', 'Email already registered'), { status: 409 });
        }
        return HttpResponse.json(wrapResponse(mockAuthResponse), { status: 201 });
      }),
    ),

  useMockMe: (user: UserDto | null = mockUser) =>
    server.use(
      http.get(`${apiUrl}/auth/me`, () => {
        if (!user) return HttpResponse.json(apiError('UNAUTHORIZED', 'Unauthorized'), { status: 401 });
        return HttpResponse.json(wrapResponse(user), { status: 200 });
      }),
    ),

  useMockLogout: () =>
    server.use(
      http.post(`${apiUrl}/auth/logout`, () => HttpResponse.json(wrapResponse(null), { status: 200 })),
    ),
};

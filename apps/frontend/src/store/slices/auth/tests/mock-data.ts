import { AuthResponseDto, LoginDto, RegisterDto, UserDto } from "@event-mgmt/shared-schemas";
import { http, HttpResponse } from 'msw';
import { RootState } from "../../../index";
import { server } from "../../../../test-utils/server";
import { AuthState } from "../authSlice";

export const validAccessToken = 'valid-test-token';
export const validRefreshToken = 'valid-test-refresh-token';
export const validEmail = 'steven-ponder@eventeer.com';
export const validPassword = 'StevenGoat67!';

const currentDateString = new Date().toISOString();
export const mockUserData: UserDto = {
  id: 'test-user-001',
  email: validEmail,
  firstName: 'Steven',
  lastName: 'Ponder',
  avatarUrl: '',
  role: "ORGANIZER",
  provider: undefined,
  isEmailVerified: true,
  isActive: true,
  lastLoginAt: currentDateString,
  createdAt: "2022-09-10T17:24:52.740Z",
  updatedAt: "2022-09-10T17:24:52.740Z",
}
export function createMockRootStateWithTokens(accessToken: string, refreshToken: string): Partial<RootState> {
  return {
    auth: { 
      accessToken,
      refreshToken,
      isAuthenticated: true,
      user: mockUserData,
      loading: false,
      error: null
    }
  }
};
export const mockRegisterUserData: RegisterDto = {
  email: 'garry-grokking@eventeer.com',
  password: 'MyDateOfBirth123',
  firstName: 'Garry',
  lastName: 'Grokking',
};
export const mockAuthResponse: AuthResponseDto = {
  accessToken: validAccessToken,
  refreshToken: validRefreshToken,
  expiresIn: 2088890271,
  user: {
    ...mockUserData,
    lastLoginAt: currentDateString,
  }
}

export const authApiMock = {
  useMockAuthHeaderCheck: () => server.use(http.get(`*/auth/me`, ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (auth === `Bearer ${validAccessToken}`) {
      return HttpResponse.json({ 
        ...mockAuthResponse
      }, { status: 200 });
    }
    return HttpResponse.json({ message: "Unauthorized (Invalid access token)" }, { status: 401 });
  })),
  useMockRefreshAuth: () => server.use(http.post<never, {token: string}>(`*/auth/refresh`, async ({ request }) => {
    const { token } = await request.json();
    if (token === validRefreshToken) {
      return HttpResponse.json({ 
        ...mockAuthResponse
      }, { status: 200 });
    }
    return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
  })),
  useMockRegisterUser: () => server.use(http.post<never, RegisterDto>(`*/auth/register`, async ({ request }) => {
    const { password, ...rest } = await request.json();
    const isNewEmail = rest.email !== 'steven-ponder@eventeer.com';
    if (!isNewEmail) return HttpResponse.json({
      message: "Duplicate email!"
    }, { status: 409 });

    return HttpResponse.json({
      id: 'test-user-002',
      ...rest,
      avatarUrl: '',
      role: 'CUSTOMER',
      provider: undefined,
      isEmailVerified: true,
      isActive: true,
      lastLoginAt: currentDateString,
      createdAt: currentDateString,
      updatedAt: currentDateString,
    }, { status: 201 })
  })),
  useMockLogin: () => server.use(http.post<never, LoginDto>(`*/auth/login`, async ({ request }) => {
    const { email, password } = await request.json();
    const isExistingUser = email === validEmail;
    if (!isExistingUser || password !== validPassword) return HttpResponse.json({
      message: "Invalid Credentials!"
    }, { status: 401 });

    return HttpResponse.json(structuredClone(mockAuthResponse), { status: 200 })
  })),
};

export const mockLoggedInAuthState: AuthState = {
  user: mockUserData,
  accessToken: validAccessToken,
  refreshToken: validRefreshToken,
  isAuthenticated: true,
  loading: false,
  error: null,
}

export const mockLoggedInRootState: Partial<RootState> = {
  auth: {...mockLoggedInAuthState},
}
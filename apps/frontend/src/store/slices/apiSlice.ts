import { createApi, fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import { Mutex } from 'async-mutex'
import { apiUrl } from '@constants/config'
import { setCredentials, clearCredentials } from './auth/authSlice'
import { AuthResponseDto, RefreshTokenDto } from '@event-mgmt/shared-schemas';

interface ServerResponse<T> {
  statusCode: number;
  error?: string;
  message?: string;
  success?: boolean;
  data?: T;
};

const apiTags = ['Event', 'User', 'Booking', 'Coupon'] as const;

const mutex = new Mutex();

interface PartialAuthState {
  auth: {
    accessToken?: string,
    refreshToken?: string,
  }
}
const baseQuery = fetchBaseQuery({
  baseUrl: new URL(apiUrl, location.origin).href,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as PartialAuthState).auth.accessToken;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const correlationId = crypto.randomUUID();
    headers.set('x-correlation-id', correlationId);

    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await mutex.waitForUnlock();
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        const state = api.getState() as PartialAuthState;
        const refreshToken = state.auth.refreshToken;

        if (refreshToken) {
          // 2. Call baseQuery with an OBJECT instead of a string
          const refreshResult = await baseQuery(
            {
              url: '/auth/refresh',
              method: 'POST',
              body: { refreshToken } as RefreshTokenDto,
            },
            api,
            extraOptions
          );

          if (refreshResult.data) {
            const refreshResultData = refreshResult.data as ServerResponse<AuthResponseDto>

            const authResponse = refreshResultData.data
            if (authResponse) {
              // Success! Dispatch the new tokens
              api.dispatch(setCredentials({ ...authResponse }));
            }
            // Retry the original request
            result = await baseQuery(args, api, extraOptions);
          } else {
            api.dispatch(clearCredentials());
          }
        } else {
          api.dispatch(clearCredentials());
        }
      } finally {
        // 4. Release the lock so other pending requests can proceed
        release();
      }
    } else {
      // 5. If the mutex was already locked, wait for it to be released
      // and then retry the original request with the new token
      await mutex.waitForUnlock();
      result = await baseQuery(args, api, extraOptions);
    }
  }
  // If we have an error at this point, return it to the hook
  if (result.error) return result;

  const payload = result.data as ServerResponse<unknown>;

  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (!payload.success && 'error' in payload) {
      return {
        error: {
          status: 'CUSTOM_ERROR',
          error: payload.error || 'Business Logic Failure',
          data: payload,
        },
      };
    }
    // Success! "Unbox" the data and return only that
    return { data: payload.data };
  }

  // Fallback for non-enveloped responses (like raw assets)
  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api', // How it shows in Redux DevTools
  baseQuery: baseQueryWithReauth,
  tagTypes: apiTags, // Define your "Cache Keys" here
  endpoints: () => ({}),
});
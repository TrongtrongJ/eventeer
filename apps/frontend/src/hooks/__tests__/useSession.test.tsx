import React, { type ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { UserDto } from '@packages/shared-schemas';
import { server } from '@/test-utils/server';
import { createTestQueryClient } from '@/test-utils/query-test-utils';
import { wrapResponse, apiError } from '@/test-utils/response-envelope';
import { apiUrl } from '@/lib/orpc/config';
import { mockUser } from '@/lib/orpc/__tests__/mock-data/auth.mock';
import { SessionSeedContext, useSession } from '../useSession';

/** Counts GET /auth/me calls; what the server seed exists to avoid. */
function trackMe(user: UserDto | null) {
  const calls = { me: 0 };
  server.use(
    http.get(`${apiUrl}/auth/me`, () => {
      calls.me++;
      return user ? HttpResponse.json(wrapResponse(user)) : HttpResponse.json(apiError('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }),
  );
  return calls;
}

const withSeed = (seed: UserDto | null | undefined) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createTestQueryClient()}>
        <SessionSeedContext.Provider value={seed}>{children}</SessionSeedContext.Provider>
      </QueryClientProvider>
    );
  };

describe('useSession (server-seeded)', () => {
  it('seed = null (no auth cookies): logged out and makes NO request', async () => {
    const calls = trackMe(mockUser);
    const { result } = renderHook(() => useSession(), { wrapper: withSeed(null) });

    // Give any stray fetch a chance to fire before asserting it did not.
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.me).toBe(0);
    expect(result.current).toMatchObject({ user: null, isAuthenticated: false, isLoading: false });
  });

  it('seed = user: authenticated immediately, with no request', async () => {
    const calls = trackMe(mockUser);
    const { result } = renderHook(() => useSession(), { wrapper: withSeed(mockUser) });

    expect(result.current.user?.email).toBe(mockUser.email);
    expect(result.current.isAuthenticated).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.me).toBe(0);
  });

  it('seed = undefined (e.g. only a refresh cookie): probes /auth/me and adopts the result', async () => {
    const calls = trackMe(mockUser);
    const { result } = renderHook(() => useSession(), { wrapper: withSeed(undefined) });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(calls.me).toBe(1);
  });

  it('seed = undefined and the probe 401s: settles as logged out (not an error)', async () => {
    const calls = trackMe(null);
    const { result } = renderHook(() => useSession(), { wrapper: withSeed(undefined) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(calls.me).toBeGreaterThanOrEqual(1);
  });
});

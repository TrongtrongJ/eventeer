'use client';

import { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orpc } from '@/lib/orpc/query';
import type { UserDto } from '@packages/shared-schemas';

/** The server's view of the session at render time. See getSessionSeed(). */
export const SessionSeedContext = createContext<UserDto | null | undefined>(undefined);

const asMeResponse = (user: UserDto) => ({ success: true as const, data: user, correlationId: '', timestamp: new Date().toISOString() });

/**
 * Client-side session hook. The access_token cookie is httpOnly, so JS can't tell "logged in" from
 * "logged out"; the server tells us instead (SessionSeedContext). With a seed we make no request at
 * all for anonymous visitors. Only when the server can't be sure do we ask GET /auth/me, whose 401
 * is "logged out", not an error.
 */
export function useSession() {
  const seed = useContext(SessionSeedContext);
  const queryClient = useQueryClient();
  const options = orpc.auth.me.queryOptions();

  const query = useQuery({
    ...options,
    retry: false,
    staleTime: 60 * 1000,
    enabled: seed !== null, // server saw no session cookies: don't probe
    initialData: seed ? asMeResponse(seed) : undefined,
  });

  // After login/logout the layout re-renders (router.refresh) with a new seed; initialData only
  // applies when a query is first created, so push later changes into the cache.
  useEffect(() => {
    if (seed) queryClient.setQueryData(options.queryKey, asMeResponse(seed));
  }, [seed, queryClient, options.queryKey]);

  const user: UserDto | null = seed === null ? null : (query.data?.data ?? null);

  return {
    user,
    isAuthenticated: !!user,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

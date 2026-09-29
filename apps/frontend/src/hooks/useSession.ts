'use client';

import { useQuery } from '@tanstack/react-query';
import { orpc } from '@/lib/orpc/query';
import type { UserDto } from '@packages/shared-schemas';

/**
 * Client-side session hook. There's no client-readable "am I logged in" flag
 * (the access_token cookie is httpOnly by design), so we just ask the
 * backend via GET /auth/me and treat a 401 as "logged out" instead of an
 * error to surface.
 */
export function useSession() {
  const query = useQuery({
    ...orpc.auth.me.queryOptions(),
    retry: false,
    staleTime: 60 * 1000,
  });

  const user: UserDto | undefined = query.data?.data;

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

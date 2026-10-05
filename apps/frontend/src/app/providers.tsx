'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactQueryStreamedHydration } from '@tanstack/react-query-next-experimental';
import type { UserDto } from '@packages/shared-schemas';
import { getQueryClient } from '@/lib/query-client';
import { SessionSeedContext } from '@/hooks/useSession';
import { SESSION_EXPIRED_EVENT } from '@/lib/orpc/browser-client';
import { ToastProvider } from '@/lib/toast/toast-context';
import ToastContainer from '@/components/ToastContainer/ToastContainer';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

/** When silent refresh fails the session is truly gone: drop cached user data and go to /login. */
function SessionExpiryHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = getQueryClient();

  useEffect(() => {
    const onExpired = () => {
      queryClient.clear();
      router.refresh(); // re-seed the session from the server (now logged out)
      const onPublicPage = PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/events/') && !pathname.includes('/coupons');
      if (!onPublicPage) router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [pathname, router, queryClient]);

  return null;
}

export function Providers({ children, sessionSeed }: { children: React.ReactNode; sessionSeed: UserDto | null | undefined }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryStreamedHydration>
        <ToastProvider>
          <SessionSeedContext.Provider value={sessionSeed}>
            <SessionExpiryHandler />
            {children}
            <ToastContainer />
          </SessionSeedContext.Provider>
        </ToastProvider>
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </ReactQueryStreamedHydration>
    </QueryClientProvider>
  );
}

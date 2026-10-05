import { QueryClient, environmentManager } from '@tanstack/react-query';

const routeFailureCodes = [401, 403, 404] as const;
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: (failureCount, error: any) => {
          // Don't retry on 401/403/404 - matches the old RTK Query CUSTOM_ERROR behavior.
          const status = error?.status ?? error?.code;
          if (routeFailureCodes.includes(status)) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (environmentManager.isServer()) {
    // Server: always make a new query client for each request.
    return makeQueryClient();
  }
  // Browser: reuse the same client across renders.
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

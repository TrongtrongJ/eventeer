import type { CurrentUserData } from '@packages/shared-schemas';

declare global {
  namespace Express {
    interface Request {
      /** Set by AuthenticationGuard. */
      user?: CurrentUserData;
      /** Set by the oRPC correlation-id middleware. */
      correlationId?: string;
    }
  }
}
export {};

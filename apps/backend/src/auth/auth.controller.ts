import { Controller } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { ConfigService } from '@nestjs/config';
import { authContract } from '@packages/contract';
import { AUTH_COOKIE } from '@packages/shared-schemas';
import { getCookie } from '@orpc/server/helpers';
import type { Request } from 'express';
import { withCorrelationId } from '../common/middleware/correlation-id.middleware';
import { withCurrentUser } from '../common/middleware/current-user.middleware';
import type { EnvConfig } from '../env.validation';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { clearAuthCookies, setAuthCookies } from './auth-cookies';
import type { SessionMeta } from './session.service';

const STRICT = { default: { limit: 10, ttl: 60_000 } };

const ok = <T>(data: T, correlationId: string) => ({
  success: true as const,
  data,
  correlationId,
  timestamp: new Date().toISOString(),
});

const metaOf = (req: Request): SessionMeta => ({
  ipAddress: req.ip ?? null,
  userAgent: req.headers['user-agent'] ?? null,
});

@Controller('auth')
export class AuthController {
  private readonly secure: boolean;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService<EnvConfig, true>,
  ) {
    this.secure = config.get('isProd', { infer: true });
  }

  @Public()
  @Throttle(STRICT)
  @Implement(authContract.register)
  async register() {
    return implement(authContract.register)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { user, tokens } = await this.authService.register(input, metaOf(context.request), context.correlationId);
        setAuthCookies(context.resHeaders, tokens, this.secure);
        return ok({ user }, context.correlationId);
      });
  }

  @Public()
  @Throttle(STRICT)
  @Implement(authContract.login)
  async login() {
    return implement(authContract.login)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { user, tokens } = await this.authService.login(input, metaOf(context.request));
        setAuthCookies(context.resHeaders, tokens, this.secure);
        return ok({ user }, context.correlationId);
      });
  }

  /**
   * @Public because by the time a refresh is needed the access cookie has
   * expired; the refresh cookie *is* the credential here.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Implement(authContract.refresh)
  async refresh() {
    return implement(authContract.refresh)
      .use(withCorrelationId)
      .handler(async ({ context }) => {
        const refreshToken = getCookie(context.reqHeaders, AUTH_COOKIE.REFRESH);
        try {
          const { user, tokens } = await this.authService.refresh(refreshToken);
          // tokens === null: a concurrent request already rotated; its cookies are in flight.
          if (tokens) setAuthCookies(context.resHeaders, tokens, this.secure);
          return ok(user, context.correlationId);
        } catch (err) {
          // Don't leave dead cookies behind: the client is logged out from here.
          clearAuthCookies(context.resHeaders, this.secure);
          throw err;
        }
      });
  }

  /** Idempotent and @Public: must work even when the access cookie has already expired. */
  @Public()
  @Implement(authContract.logout)
  async logout() {
    return implement(authContract.logout)
      .use(withCorrelationId)
      .handler(async ({ context }) => {
        await this.authService.logout(
          getCookie(context.reqHeaders, AUTH_COOKIE.ACCESS),
          getCookie(context.reqHeaders, AUTH_COOKIE.REFRESH),
        );
        clearAuthCookies(context.resHeaders, this.secure);
        return ok(null, context.correlationId);
      });
  }

  @Implement(authContract.me)
  async me() {
    return implement(authContract.me)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ context }) => {
        const user = await this.authService.getMe(context.user.userId);
        return ok(user, context.correlationId);
      });
  }

  @Public()
  @Throttle(STRICT)
  @Implement(authContract.verifyEmail)
  async verifyEmail() {
    return implement(authContract.verifyEmail)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        await this.authService.verifyEmail(input);
        return ok({ message: 'Email verified successfully' }, context.correlationId);
      });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Implement(authContract.forgotPassword)
  async forgotPassword() {
    return implement(authContract.forgotPassword)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        await this.authService.forgotPassword(input.email, context.correlationId);
        return ok({ message: 'If that email is registered, a reset link has been sent' }, context.correlationId);
      });
  }

  @Public()
  @Throttle(STRICT)
  @Implement(authContract.resetPassword)
  async resetPassword() {
    return implement(authContract.resetPassword)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        await this.authService.resetPassword(input);
        return ok({ message: 'Password has been reset. Please sign in.' }, context.correlationId);
      });
  }
}

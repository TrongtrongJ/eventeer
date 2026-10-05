import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_COOKIE } from '@packages/shared-schemas';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SessionService } from '../session.service';
import { getRequest } from '../utils/request.util';

/**
 * Global, default-deny authentication for REST/oRPC and GraphQL.
 *
 * Resolves the opaque access-token cookie to a principal and attaches it as
 * `request.user`. Routes marked @Public() are still *optionally* authenticated
 * (a valid cookie populates `request.user`), but never rejected.
 *
 * An expired access cookie is dropped by the browser, so the typical failure
 * is "no cookie" -> 401 -> the client calls POST /auth/refresh and retries.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequest(context);
    if (!request) return true; // not an HTTP/GraphQL request (e.g. websocket)

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const token = request.cookies?.[AUTH_COOKIE.ACCESS] as string | undefined;
    const user = token ? await this.sessions.authenticate(token) : null;

    if (user) (request as any).user = user;
    if (user || isPublic) return true;

    throw new UnauthorizedException('Authentication required');
  }
}

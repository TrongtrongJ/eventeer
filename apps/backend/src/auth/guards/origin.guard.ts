import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../env.validation';
import { getRequest } from '../utils/request.util';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defence-in-depth CSRF protection for cookie auth, on top of SameSite=Lax:
 * a state-changing request that carries an Origin header must come from the
 * web app (or this API's own origin, e.g. GraphiQL). Requests with no Origin
 * (curl, server-to-server, Stripe webhooks) cannot ride a victim's cookies, so
 * they pass through.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigin: string;

  constructor(config: ConfigService<EnvConfig, true>) {
    this.allowedOrigin = new URL(config.get('FRONTEND_URL', { infer: true })).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = getRequest(context);
    if (!request || SAFE_METHODS.has(request.method)) return true;

    const origin = request.headers.origin;
    if (!origin) return true;

    let sameHost = false;
    try {
      sameHost = new URL(origin).host === request.headers.host;
    } catch {
      /* malformed Origin falls through to rejection */
    }

    if (origin === this.allowedOrigin || sameHost) return true;
    throw new ForbiddenException('Cross-origin request blocked');
  }
}

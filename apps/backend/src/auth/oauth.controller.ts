import { BadRequestException, Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AUTH_COOKIE } from '@packages/shared-schemas';
import type { EnvConfig } from '../env.validation';
import { Public } from './decorators/public.decorator';
import { OAuthService } from './oauth.service';
import { setAuthCookiesOnResponse } from './auth-cookies';
import { generateToken, safeEqual } from './utils/token.util';
import type { AuthResult } from './auth.service';
import type { SessionMeta } from './session.service';

type Provider = 'google' | 'github' | 'facebook';
const PROVIDERS: Provider[] = ['google', 'github', 'facebook'];
const STATE_COOKIE_PATH = '/auth/oauth';

/**
 * Browser-redirect OAuth. The session cookies are set directly on the callback
 * response and the browser is bounced to the web app, so no token ever appears
 * in a URL, a Referer header, browser history, or JavaScript.
 */
@Public()
@Controller('auth/oauth')
export class OAuthController {
  private readonly frontendUrl: string;
  private readonly secure: boolean;

  constructor(
    private readonly oauth: OAuthService,
    config: ConfigService<EnvConfig, true>,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', { infer: true }).replace(/\/$/, '');
    this.secure = config.get('isProd', { infer: true });
  }

  @Get(':provider')
  start(@Param('provider') provider: string, @Res() res: Response) {
    const p = this.assertProvider(provider);

    // Bind the round-trip to this browser: verified again in the callback.
    const state = generateToken();
    res.cookie(AUTH_COOKIE.OAUTH_STATE, state, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: STATE_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });

    const url =
      p === 'google'
        ? this.oauth.getGoogleAuthUrl(state)
        : p === 'github'
          ? this.oauth.getGitHubAuthUrl(state)
          : this.oauth.getFacebookAuthUrl(state);
    res.redirect(url);
  }

  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request & { correlationId?: string },
    @Res() res: Response,
  ) {
    const p = this.assertProvider(provider);
    const expected = req.cookies?.[AUTH_COOKIE.OAUTH_STATE] as string | undefined;
    res.clearCookie(AUTH_COOKIE.OAUTH_STATE, { path: STATE_COOKIE_PATH });

    if (!code || !state || !expected || !safeEqual(state, expected)) {
      return res.redirect(`${this.frontendUrl}/login?error=oauth_state`);
    }

    const meta: SessionMeta = { ipAddress: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
    const correlationId = req.correlationId ?? 'oauth-callback';

    try {
      const result: AuthResult =
        p === 'google'
          ? await this.oauth.handleGoogleCallback(code, meta, correlationId)
          : p === 'github'
            ? await this.oauth.handleGitHubCallback(code, meta, correlationId)
            : await this.oauth.handleFacebookCallback(code, meta, correlationId);

      setAuthCookiesOnResponse(res, result.tokens, this.secure);
      return res.redirect(`${this.frontendUrl}/`);
    } catch {
      return res.redirect(`${this.frontendUrl}/login?error=oauth_failed`);
    }
  }

  private assertProvider(provider: string): Provider {
    if (!PROVIDERS.includes(provider as Provider)) throw new BadRequestException('Unsupported OAuth provider');
    return provider as Provider;
  }
}

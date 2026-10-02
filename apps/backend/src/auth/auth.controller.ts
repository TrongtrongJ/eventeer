import {
  Controller,
  Get,
  Req,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import * as crypto from 'crypto';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { authContract } from '@packages/contract';
import { withCorrelationId } from '../common/middleware/correlation-id.middleware';
import { withCurrentUser } from '../common/middleware/current-user.middleware';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
  ) {}

  @Public()
  @Implement(authContract.register)
  async register() {
    return implement(authContract.register)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { correlationId } = context;
        const result = await this.authService.register(input, correlationId);
        return {
          success: true,
          data: result,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Public()
  @Implement(authContract.login)
  async login() {
    return implement(authContract.login)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { correlationId, request } = context;
        const result = await this.authService.login(
          input,
          request.ip || '',
          request.headers['user-agent'] || '',
          correlationId,
        );
        return {
          success: true,
          data: result,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(authContract.refresh)
  async refresh() {
    return implement(authContract.refresh)
      .use(withCorrelationId)
      .handler(async ({ context }) => {
        const { correlationId, request } = context;
        const result = await this.authService.refresh(request);
        return {
          success: true,
          data: result,
          correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(authContract.logout)
  async logout() {
    return implement(authContract.logout)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ context }) => {
        const { request, user, correlationId } = context;
        await this.authService.logout(user.sessionId, request, correlationId);
        return {
          success: true,
          data: null,
          correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Public()
  @Implement(authContract.verifyEmail)
  async verifyEmail() {
    return implement(authContract.verifyEmail)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { correlationId } = context;
        await this.authService.verifyEmail(input.token, correlationId);
        return {
          success: true,
          data: { message: 'Email verified successfully' },
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Public()
  @Implement(authContract.forgotPassword)
  async forgotPassword() {
    return implement(authContract.forgotPassword)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { correlationId } = context;
        await this.authService.forgotPassword(input.email, correlationId);
        return {
          success: true,
          data: { message: 'Password reset email sent' },
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Public()
  @Implement(authContract.resetPassword)
  async resetPassword() {
    return implement(authContract.resetPassword)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { token, newPassword } = input;
        const { correlationId } = context;
        await this.authService.resetPassword(token, newPassword, correlationId);
        return {
          success: true,
          data: { message: 'Password reset successfully' },
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(authContract.me)
  async me() {
    return implement(authContract.me)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ context }) => {
        const { user, correlationId } = context;
        const fullUser = await this.authService.validateUser(user.userId);
        return {
          success: true,
          data: fullUser,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Public()
  @Get('oauth/google')
  googleAuth(@Res() res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    const url = this.oauthService.getGoogleAuthUrl(state);
    res.redirect(url);
  }

  @Public()
  @Get('oauth/google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const result = await this.oauthService.handleGoogleCallback(code, req.correlationId);

    // Redirect to frontend with tokens
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`,
    );
  }

  @Public()
  @Get('oauth/github')
  githubAuth(@Res() res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    const url = this.oauthService.getGitHubAuthUrl(state);
    res.redirect(url);
  }

  @Public()
  @Get('oauth/github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const result = await this.oauthService.handleGitHubCallback(code, req.correlationId);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`,
    );
  }

  @Public()
  @Get('oauth/facebook')
  facebookAuth(@Res() res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    const url = this.oauthService.getFacebookAuthUrl(state);
    res.redirect(url);
  }

  @Public()
  @Get('oauth/facebook/callback')
  async facebookCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const result = await this.oauthService.handleFacebookCallback(code, req.correlationId);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${result.accessToken}&refreshToken=${result.refreshToken}`,
    );
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from '@event-mgmt/shared-schemas';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser, CurrentUserData } from './decorators/current-user.decorator';
import * as crypto from 'crypto';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) registerDto: RegisterDto,
    @Req() req: any,
  ) {
    const result = await this.authService.register(registerDto, req.correlationId);
    return {
      success: true,
      data: result,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body(new ZodValidationPipe(LoginSchema)) loginDto: LoginDto, @Req() req: any) {
    const result = await this.authService.login(
      loginDto,
      req.ip,
      req.headers['user-agent'],
      req.correlationId,
    );
    return {
      success: true,
      data: result,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(RefreshTokenSchema)) refreshTokenDto: RefreshTokenDto,
    @Req() req: any,
  ) {
    const result = await this.authService.refreshToken(
      refreshTokenDto.refreshToken,
      req.correlationId,
    );
    return {
      success: true,
      data: result,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: CurrentUserData, @Req() req: any) {
    await this.authService.logout(user.sessionId, req.correlationId);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body(new ZodValidationPipe(VerifyEmailSchema)) verifyDto: VerifyEmailDto,
    @Req() req: any,
  ) {
    await this.authService.verifyEmail(verifyDto.token, req.correlationId);
    return {
      success: true,
      message: 'Email verified successfully',
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordSchema)) forgotDto: ForgotPasswordDto,
    @Req() req: any,
  ) {
    await this.authService.forgotPassword(forgotDto.email, req.correlationId);
    return {
      success: true,
      message: 'Password reset email sent',
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordSchema)) resetDto: ResetPasswordDto,
    @Req() req: any,
  ) {
    await this.authService.resetPassword(resetDto.token, resetDto.newPassword, req.correlationId);
    return {
      success: true,
      message: 'Password reset successfully',
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('me')
  async getCurrentUser(@CurrentUser() user: CurrentUserData, @Req() req: any) {
    const fullUser = await this.authService.validateUser(user.userId);
    return {
      success: true,
      data: fullUser,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('oauth/google')
  googleAuth(@Res() res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    const url = this.oauthService.getGoogleAuthUrl(state);
    res.redirect(url);
  }

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

  @Get('oauth/github')
  githubAuth(@Res() res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    const url = this.oauthService.getGitHubAuthUrl(state);
    res.redirect(url);
  }

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

  @Get('oauth/facebook')
  facebookAuth(@Res() res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    const url = this.oauthService.getFacebookAuthUrl(state);
    res.redirect(url);
  }

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

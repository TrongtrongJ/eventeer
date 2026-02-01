import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { User, UserRole, AuthProvider } from '../entities/user.entity';
import { AuthService } from './auth.service';

interface OAuthProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  provider: AuthProvider;
}

interface GoogleOAuthTokenRes {
  access_token: string;
  token_type: 'Bearer';
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly httpService: HttpService,
  ) {}

  // Google OAuth
  getGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.configService.get('GOOGLE_CLIENT_ID')!,
      redirect_uri: this.configService.get('GOOGLE_REDIRECT_URI')!,
      response_type: 'code',
      scope: 'openid profile email',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(code: string, correlationId: string) {
    try {
      // Exchange code for tokens
      const tokenResponse = await firstValueFrom(
        this.httpService.post<GoogleOAuthTokenRes>('https://oauth2.googleapis.com/token', {
          code,
          client_id: this.configService.get('GOOGLE_CLIENT_ID'),
          client_secret: this.configService.get('GOOGLE_CLIENT_SECRET'),
          redirect_uri: this.configService.get('GOOGLE_REDIRECT_URI'),
          grant_type: 'authorization_code',
        }),
      );

      const { access_token } = tokenResponse.data;

      // Get user profile
      const profileResponse = await firstValueFrom(
        this.httpService.get('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` },
        }),
      );

      const profile: OAuthProfile = {
        id: profileResponse.data.id,
        email: profileResponse.data.email,
        firstName: profileResponse.data.given_name || 'User',
        lastName: profileResponse.data.family_name || '',
        avatarUrl: profileResponse.data.picture,
        provider: AuthProvider.GOOGLE,
      };

      return this.handleOAuthLogin(profile, correlationId);
    } catch (error) {
      this.logger.error({
        message: 'Google OAuth failed',
        correlationId,
        error: error.message,
      });
      throw new BadRequestException('Google authentication failed');
    }
  }

  // GitHub OAuth
  getGitHubAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.configService.get('GITHUB_CLIENT_ID')!,
      redirect_uri: this.configService.get('GITHUB_REDIRECT_URI')!,
      scope: 'user:email',
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleGitHubCallback(code: string, correlationId: string) {
    try {
      // Exchange code for token
      const tokenResponse = await firstValueFrom(
        this.httpService.post(
          'https://github.com/login/oauth/access_token',
          {
            client_id: this.configService.get('GITHUB_CLIENT_ID'),
            client_secret: this.configService.get('GITHUB_CLIENT_SECRET'),
            code,
            redirect_uri: this.configService.get('GITHUB_REDIRECT_URI'),
          },
          {
            headers: { Accept: 'application/json' },
          },
        ),
      );

      const { access_token } = tokenResponse.data;

      // Get user profile
      const [userResponse, emailsResponse] = await Promise.all([
        firstValueFrom(
          this.httpService.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${access_token}` },
          }),
        ),
        firstValueFrom(
          this.httpService.get('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${access_token}` },
          }),
        ),
      ]);

      const primaryEmail = emailsResponse.data.find((e: any) => e.primary)?.email;
      const nameParts = userResponse.data.name?.split(' ') || ['User'];

      const profile: OAuthProfile = {
        id: userResponse.data.id.toString(),
        email: primaryEmail || userResponse.data.email,
        firstName: nameParts[0] || 'User',
        lastName: nameParts.slice(1).join(' ') || '',
        avatarUrl: userResponse.data.avatar_url,
        provider: AuthProvider.GITHUB,
      };

      return this.handleOAuthLogin(profile, correlationId);
    } catch (error) {
      this.logger.error({
        message: 'GitHub OAuth failed',
        correlationId,
        error: error.message,
      });
      throw new BadRequestException('GitHub authentication failed');
    }
  }

  // Facebook OAuth
  getFacebookAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.configService.get('FACEBOOK_APP_ID')!,
      redirect_uri: this.configService.get('FACEBOOK_REDIRECT_URI')!,
      scope: 'email,public_profile',
      state,
    });

    return `https://www.facebook.com/v12.0/dialog/oauth?${params.toString()}`;
  }

  async handleFacebookCallback(code: string, correlationId: string) {
    try {
      // Exchange code for token
      const tokenResponse = await firstValueFrom(
        this.httpService.get('https://graph.facebook.com/v12.0/oauth/access_token', {
          params: {
            client_id: this.configService.get('FACEBOOK_APP_ID'),
            client_secret: this.configService.get('FACEBOOK_APP_SECRET'),
            redirect_uri: this.configService.get('FACEBOOK_REDIRECT_URI'),
            code,
          },
        }),
      );

      const { access_token } = tokenResponse.data;

      // Get user profile
      const profileResponse = await firstValueFrom(
        this.httpService.get('https://graph.facebook.com/me', {
          params: {
            fields: 'id,email,first_name,last_name,picture',
            access_token,
          },
        }),
      );

      const profile: OAuthProfile = {
        id: profileResponse.data.id,
        email: profileResponse.data.email,
        firstName: profileResponse.data.first_name || 'User',
        lastName: profileResponse.data.last_name || '',
        avatarUrl: profileResponse.data.picture?.data?.url,
        provider: AuthProvider.FACEBOOK,
      };

      return this.handleOAuthLogin(profile, correlationId);
    } catch (error) {
      this.logger.error({
        message: 'Facebook OAuth failed',
        correlationId,
        error: error.message,
      });
      throw new BadRequestException('Facebook authentication failed');
    }
  }

  private async handleOAuthLogin(profile: OAuthProfile, correlationId: string) {
    this.logger.log({
      message: 'OAuth login attempt',
      correlationId,
      provider: profile.provider,
      email: profile.email,
    });

    // Check if user exists
    let user = await this.userRepository.findOne({
      where: [
        { email: profile.email, provider: profile.provider },
        { providerId: profile.id, provider: profile.provider },
      ],
    });

    if (!user) {
      // Check if email exists with different provider
      const existingUser = await this.userRepository.findOne({
        where: { email: profile.email },
      });

      if (existingUser) {
        // Link OAuth account to existing user
        existingUser.providerId = profile.id;
        existingUser.avatarUrl = profile.avatarUrl || existingUser.avatarUrl;
        existingUser.isEmailVerified = true; // Trust OAuth provider
        user = await this.userRepository.save(existingUser);

        this.logger.log({
          message: 'OAuth account linked to existing user',
          correlationId,
          userId: user.id,
          provider: profile.provider,
        });
      } else {
        // Create new user
        user = this.userRepository.create({
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          provider: profile.provider,
          providerId: profile.id,
          role: UserRole.CUSTOMER,
          isEmailVerified: true, // Trust OAuth provider
          isActive: true,
        });

        user = await this.userRepository.save(user);

        this.logger.log({
          message: 'New user created via OAuth',
          correlationId,
          userId: user.id,
          provider: profile.provider,
        });
      }
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // Generate auth response using AuthService
    return this.authService['generateAuthResponse'](user, correlationId);
  }
}

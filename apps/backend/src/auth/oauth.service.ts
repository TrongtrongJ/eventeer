import { Injectable, Logger, BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { HttpService } from "@nestjs/axios";
import type { AxiosRequestConfig } from "axios";
import { firstValueFrom } from "rxjs";
import { ResilienceService, type ResiliencePolicy } from "@nestjs/resilience";
import { RESILIENCE_PRESET } from "../config/resilience.config";
import { User, UserRole, AuthProvider } from "../entities/user.entity";
import { AuthResult, AuthService } from "./auth.service";
import type { SessionMeta } from "./session.service";

interface OAuthProfile {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    provider: AuthProvider;
    /** True only when the provider itself asserts the user controls this email. */
    emailVerified: boolean;
}

interface GoogleOAuthTokenRes {
    access_token: string;
    token_type: "Bearer";
}

type OAuthProvider = "google" | "github" | "facebook";

@Injectable()
export class OAuthService {
    private readonly logger = new Logger(OAuthService.name);
    /** One circuit breaker per provider: Google being down must not block GitHub sign-in. */
    private readonly policies: Record<OAuthProvider, ResiliencePolicy>;

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
        private readonly authService: AuthService,
        private readonly httpService: HttpService,
        resilience: ResilienceService,
    ) {
        this.policies = {
            google: resilience.preset(RESILIENCE_PRESET.OAUTH_GOOGLE),
            github: resilience.preset(RESILIENCE_PRESET.OAUTH_GITHUB),
            facebook: resilience.preset(RESILIENCE_PRESET.OAUTH_FACEBOOK),
        };
    }

    /**
     * Every outbound provider request goes through here: it gets the provider's timeout and breaker, and
     * the attempt's AbortSignal so a timed-out request is actually cancelled, not left running.
     */
    private send<T = any>(provider: OAuthProvider, config: AxiosRequestConfig): Promise<{ data: T }> {
        return this.policies[provider].execute(
            ({ signal }) => firstValueFrom(this.httpService.request<T>({ ...config, signal })),
            { source: `OAuthService.${provider}` },
        );
    }

    // Google OAuth
    getGoogleAuthUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.configService.get("GOOGLE_CLIENT_ID")!,
            redirect_uri: this.configService.get("GOOGLE_REDIRECT_URI")!,
            response_type: "code",
            scope: "openid profile email",
            state,
            access_type: "offline",
            prompt: "consent",
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    async handleGoogleCallback(code: string, meta: SessionMeta, correlationId: string): Promise<AuthResult> {
        try {
            // Exchange code for tokens
            const tokenResponse = await this.send<GoogleOAuthTokenRes>("google", {
                method: "POST",
                url: "https://oauth2.googleapis.com/token",
                data: {
                    code,
                    client_id: this.configService.get("GOOGLE_CLIENT_ID"),
                    client_secret: this.configService.get("GOOGLE_CLIENT_SECRET"),
                    redirect_uri: this.configService.get("GOOGLE_REDIRECT_URI"),
                    grant_type: "authorization_code",
                },
            });

            const { access_token } = tokenResponse.data;

            // Get user profile
            const profileResponse = await this.send("google", {
                method: "GET",
                url: "https://www.googleapis.com/oauth2/v2/userinfo",
                headers: { Authorization: `Bearer ${access_token}` },
            });

            const profile: OAuthProfile = {
                id: profileResponse.data.id,
                email: profileResponse.data.email,
                firstName: profileResponse.data.given_name || "User",
                lastName: profileResponse.data.family_name || "",
                avatarUrl: profileResponse.data.picture,
                provider: AuthProvider.GOOGLE,
                emailVerified: profileResponse.data.verified_email === true,
            };

            return this.handleOAuthLogin(profile, meta, correlationId);
        } catch (error: any) {
            this.logger.error({
                message: "Google OAuth failed",
                correlationId,
                error: error.message,
            });
            throw new BadRequestException("Google authentication failed");
        }
    }

    // GitHub OAuth
    getGitHubAuthUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.configService.get("GITHUB_CLIENT_ID")!,
            redirect_uri: this.configService.get("GITHUB_REDIRECT_URI")!,
            scope: "user:email",
            state,
        });

        return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    async handleGitHubCallback(code: string, meta: SessionMeta, correlationId: string): Promise<AuthResult> {
        try {
            // Exchange code for token
            const tokenResponse = await this.send("github", {
                method: "POST",
                url: "https://github.com/login/oauth/access_token",
                data: {
                    client_id: this.configService.get("GITHUB_CLIENT_ID"),
                    client_secret: this.configService.get("GITHUB_CLIENT_SECRET"),
                    code,
                    redirect_uri: this.configService.get("GITHUB_REDIRECT_URI"),
                },
                headers: { Accept: "application/json" },
            });

            const { access_token } = tokenResponse.data;

            // Get user profile
            const headers = { Authorization: `Bearer ${access_token}` };
            const [userResponse, emailsResponse] = await Promise.all([
                this.send("github", { method: "GET", url: "https://api.github.com/user", headers }),
                this.send("github", { method: "GET", url: "https://api.github.com/user/emails", headers }),
            ]);

            // Only a primary AND verified GitHub email may identify the user.
            const primaryEmail = emailsResponse.data.find((e: any) => e.primary && e.verified)?.email;
            const nameParts = userResponse.data.name?.split(" ") || ["User"];

            const profile: OAuthProfile = {
                id: userResponse.data.id.toString(),
                email: primaryEmail,
                firstName: nameParts[0] || "User",
                lastName: nameParts.slice(1).join(" ") || "",
                avatarUrl: userResponse.data.avatar_url,
                provider: AuthProvider.GITHUB,
                emailVerified: !!primaryEmail,
            };

            return this.handleOAuthLogin(profile, meta, correlationId);
        } catch (error: any) {
            this.logger.error({
                message: "GitHub OAuth failed",
                correlationId,
                error: error.message,
            });
            throw new BadRequestException("GitHub authentication failed");
        }
    }

    // Facebook OAuth
    getFacebookAuthUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.configService.get("FACEBOOK_APP_ID")!,
            redirect_uri: this.configService.get("FACEBOOK_REDIRECT_URI")!,
            scope: "email,public_profile",
            state,
        });

        return `https://www.facebook.com/v12.0/dialog/oauth?${params.toString()}`;
    }

    async handleFacebookCallback(code: string, meta: SessionMeta, correlationId: string): Promise<AuthResult> {
        try {
            // Exchange code for token
            const tokenResponse = await this.send("facebook", {
                method: "GET",
                url: "https://graph.facebook.com/v12.0/oauth/access_token",
                params: {
                    client_id: this.configService.get("FACEBOOK_APP_ID"),
                    client_secret: this.configService.get("FACEBOOK_APP_SECRET"),
                    redirect_uri: this.configService.get("FACEBOOK_REDIRECT_URI"),
                    code,
                },
            });

            const { access_token } = tokenResponse.data;

            // Get user profile
            const profileResponse = await this.send("facebook", {
                method: "GET",
                url: "https://graph.facebook.com/me",
                params: {
                    fields: "id,email,first_name,last_name,picture",
                    access_token,
                },
            });

            const profile: OAuthProfile = {
                id: profileResponse.data.id,
                email: profileResponse.data.email,
                firstName: profileResponse.data.first_name || "User",
                lastName: profileResponse.data.last_name || "",
                avatarUrl: profileResponse.data.picture?.data?.url,
                provider: AuthProvider.FACEBOOK,
                emailVerified: false, // Facebook gives no verification signal
            };

            return this.handleOAuthLogin(profile, meta, correlationId);
        } catch (error: any) {
            this.logger.error({
                message: "Facebook OAuth failed",
                correlationId,
                error: error.message,
            });
            throw new BadRequestException("Facebook authentication failed");
        }
    }

    private async handleOAuthLogin(
        profile: OAuthProfile,
        meta: SessionMeta,
        correlationId: string,
    ): Promise<AuthResult> {
        if (!profile.email) {
            throw new BadRequestException("The provider did not return a verified email address");
        }
        const email = profile.email.toLowerCase();

        let user = await this.userRepository.findOne({
            where: { provider: profile.provider, providerId: profile.id },
        });

        if (!user) {
            const existing = await this.userRepository.findOne({ where: { email } });

            if (existing) {
                // Never link on an unverified provider email: that's an account-takeover vector.
                if (!profile.emailVerified) {
                    throw new ConflictException(
                        "An account with this email already exists. Sign in with your original method.",
                    );
                }
                if (!existing.isEmailVerified) {
                    // The local account may have been pre-registered by someone who doesn't own the
                    // mailbox. The provider just proved who does, so strip any credentials they set.
                    existing.passwordHash = null;
                    existing.emailVerificationToken = null;
                    existing.passwordResetToken = null;
                }
                existing.isEmailVerified = true;
                existing.avatarUrl = existing.avatarUrl || profile.avatarUrl;
                user = await this.userRepository.save(existing);
                this.logger.log({ message: "OAuth identity linked to existing user", correlationId, userId: user.id });
            } else {
                user = await this.userRepository.save(
                    this.userRepository.create({
                        email,
                        firstName: profile.firstName,
                        lastName: profile.lastName,
                        avatarUrl: profile.avatarUrl,
                        provider: profile.provider,
                        providerId: profile.id,
                        role: UserRole.CUSTOMER,
                        isEmailVerified: profile.emailVerified,
                        isActive: true,
                    }),
                );
                this.logger.log({
                    message: "User created via OAuth",
                    correlationId,
                    userId: user.id,
                    provider: profile.provider,
                });
            }
        }

        if (!user.isActive) throw new UnauthorizedException("This account has been disabled");
        return this.authService.startSession(user, meta);
    }
}

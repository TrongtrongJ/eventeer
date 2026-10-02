import type { Request } from 'express';
import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from '@node-rs/bcrypt';
import * as crypto from 'crypto';
import { setCookie, deleteCookie } from '@orpc/server/helpers';
import { User, UserRole, AuthProvider } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { RegisterDto, LoginDto, UserDto, AuthResponseDto, AUTH_COOKIE, JwtUserData, getCookieOptions } from '@packages/shared-schemas';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/user.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly userService: UsersService,
  ) {}

  async register(registerDto: RegisterDto, correlationId: string): Promise<AuthResponseDto> {
    this.logger.log({
      message: 'User registration attempt',
      correlationId,
      email: registerDto.email,
    });

    // Check if user exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = this.userRepository.create({
      email: registerDto.email,
      passwordHash: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: UserRole.CUSTOMER,
      provider: AuthProvider.LOCAL,
      emailVerificationToken,
      emailVerificationExpires,
    });

    const savedUser = await this.userRepository.save(user);

    // Send verification email
    await this.emailService.queueEmailVerification(
      {
        email: savedUser.email,
        firstName: savedUser.firstName,
        token: emailVerificationToken,
      },
      correlationId,
    );

    this.logger.log({
      message: 'User registered successfully',
      correlationId,
      userId: savedUser.id,
    });

    // Generate tokens
    return this.generateAuthResponse(savedUser, correlationId);
  }

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string, correlationId: string): Promise<AuthResponseDto> {
    this.logger.log({
      message: 'User login attempt',
      correlationId,
      email: loginDto.email,
    });

    const user = await this.validateUserCredentials(loginDto.email, loginDto.password);
    await this.issueTokensAndSetCookies(user);

    this.logger.log({
      message: 'User logged in successfully',
      correlationId,
      userId: user.id,
    });

    return this.generateAuthResponse(user, correlationId, ipAddress, userAgent);
  }

  async getMe(req: JwtUserData) {
      return { user: { id: req.sub, email: req.email }};
  }

  async refresh(req: Request) {
      const rawRefreshToken: string | undefined = req.cookies[AUTH_COOKIE.REFRESH];
      if (!rawRefreshToken) {
          this.clearAuthCookies();
          throw new UnauthorizedException("No refresh token provided");
      }

      let payload: JwtUserData;
      try {
          payload = this.jwtService.verify<JwtUserData>(rawRefreshToken, {
              secret: this.configService.get("REFRESH_TOKEN_SECRET"),
          });
      } catch {
          this.clearAuthCookies();
          throw new ForbiddenException("Refresh token is invalid or expired");
      }

      const user = await this.userService.findById(payload.sub);
      if (!user) {
          this.clearAuthCookies();
          throw new ForbiddenException("User no longer exists");
      }

      const matchedRt = await this.userService.validateRefreshToken(user.id, rawRefreshToken);
      if (!matchedRt) {
          // Possible token reuse — revoke all sessions
          await this.userService.clearAllRefreshTokens(user.id);
          this.clearAuthCookies();
          throw new ForbiddenException("Refresh token reuse detected. All sessions revoked.");
      }

      // Rotate: remove the matched RT row, issue new pair
      await this.userService.removeRefreshTokenById(matchedRt.id);
      await this.issueTokensAndSetCookies(user);

      return user;
  }


  async logout(sessionId: string, req: Request, correlationId: string): Promise<void> {
    const rawRefreshToken: string | undefined = req.cookies[AUTH_COOKIE.REFRESH];
    const currentSession = await this.sessionRepository.findOne({ where: {
      id: sessionId,
    }})
    if (currentSession) {
      const { userId } = currentSession;
      this.clearAuthCookies();
      if (rawRefreshToken) {
        const rt = await this.userService.validateRefreshToken(userId, rawRefreshToken);
        if (rt) await this.userService.removeRefreshTokenById(rt.id);
      }
      await this.sessionRepository.update(
        { id: sessionId },
        { isValid: false },
      );
    }

    this.logger.log({
      message: 'User logged out',
      correlationId,
      sessionId,
    });
  }

  async verifyEmail(token: string, correlationId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { 
        emailVerificationToken: token,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Verification token expired');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;

    await this.userRepository.save(user);

    this.logger.log({
      message: 'Email verified',
      correlationId,
      userId: user.id,
    });
  }

  async forgotPassword(email: string, correlationId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      // Don't reveal that user doesn't exist
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;

    await this.userRepository.save(user);

    await this.emailService.queuePasswordReset(
      {
        email: user.email,
        firstName: user.firstName,
        token: resetToken,
      },
      correlationId,
    );

    this.logger.log({
      message: 'Password reset requested',
      correlationId,
      userId: user.id,
    });
  }

  async resetPassword(token: string, newPassword: string, correlationId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { passwordResetToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid reset token');
    }

    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      throw new BadRequestException('Reset token expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    user.passwordHash = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await this.userRepository.save(user);

    // Invalidate all sessions
    await this.sessionRepository.update(
      { userId: user.id },
      { isValid: false },
    );

    this.logger.log({
      message: 'Password reset successful',
      correlationId,
      userId: user.id,
    });
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async generateAuthResponse(
    user: User,
    correlationId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // Create session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    const session = this.sessionRepository.create({
      userId: user.id,
      refreshToken: '', // Will be set after generating
      ipAddress,
      userAgent,
      expiresAt,
    });

    console.log("session created")

    const savedSession = await this.sessionRepository.save(session);

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: savedSession.id,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES', '15m'),
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, sessionId: savedSession.id },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES', '7d'),
      },
    );

    console.log("JWTs sighned")

    // Update session with refresh token
    savedSession.refreshToken = refreshToken;
    await this.sessionRepository.save(savedSession);

    return {
      accessToken,
      refreshToken,
      user: this.toUserDto(user),
      expiresIn: 900, // 15 minutes in seconds
    };
  }

    private async validateUserCredentials(email: string, password: string): Promise<User> {
        const user = await this.userService.findByEmail(email);
        // Always run bcrypt.compare to prevent user-enumeration via timing
        const valid = user ? await this.userService.validatePassword(user, password) : await fakeHash();

        if (!user || !valid) {
            throw new UnauthorizedException("Invalid email or password");
        }
        return user;
    }

    private async issueTokensAndSetCookies(user: User) {
        const payload: JwtUserData = { sub: user.id, email: user.email };
        console.log({ payload })

        const accessTokenSecret = this.configService.get("JWT_ACCESS_SECRET");
        const refreshTokenSecret = this.configService.get("JWT_REFRESH_SECRET");
        const accessTokenExpiry = this.configService.get("JWT_ACCESS_EXPIRES");
        const refreshTokenExpiry = this.configService.get("JWT_REFRESH_EXPIRES");
        const accessToken = this.jwtService.sign(payload, {
            secret: accessTokenSecret,
            expiresIn: accessTokenExpiry,
        });

        const refreshToken = this.jwtService.sign(
            { ...payload, jti: crypto.randomUUID() },
            {
                secret: refreshTokenSecret,
                expiresIn: refreshTokenExpiry,
            },
        );

        // Persist hashed refresh token
        await this.userService.addRefreshToken(user.id, refreshToken);

        const isProd = this.configService.get("isProd");
        const cookieBase = getCookieOptions({
            secure: isProd,
        });
        const resHeaders = new Headers();

        setCookie(resHeaders, AUTH_COOKIE.ACCESS, accessToken, {
            ...cookieBase,
            maxAge: this.configService.get("accessTokenMs"),
        });

        setCookie(resHeaders, AUTH_COOKIE.REFRESH, refreshToken, {
            ...cookieBase,
            maxAge: this.configService.get("refreshTokenMs"),
        });
    }

    private clearAuthCookies() {
        const headers = new Headers();
        deleteCookie(headers, AUTH_COOKIE.ACCESS, { path: "/" });
        deleteCookie(headers, AUTH_COOKIE.REFRESH, { path: "/" });
    }

  private toUserDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role: user.role as any,
      provider: user.provider as any,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

/**
 * Run a dummy bcrypt hash when the user isn't found to prevent timing-based
 * user enumeration attacks.
 */
async function fakeHash(): Promise<boolean> {
    const bcrypt = await import("bcrypt");
    await bcrypt.compare("dummy", "$2b$12$invalidhashfortimingprotection000000000000");
    return false;
}
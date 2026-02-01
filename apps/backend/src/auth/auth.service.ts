import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserRole, AuthProvider } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { RegisterDto, LoginDto, UserDto, AuthResponseDto } from '@event-mgmt/shared-schemas';
import { EmailService } from '../email/email.service';

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
      password: hashedPassword,
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

    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    this.logger.log({
      message: 'User logged in successfully',
      correlationId,
      userId: user.id,
    });

    return this.generateAuthResponse(user, correlationId, ipAddress, userAgent);
  }

  async refreshToken(refreshToken: string, correlationId: string): Promise<AuthResponseDto> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Find session
      const session = await this.sessionRepository.findOne({
        where: { 
          refreshToken,
          isValid: true,
        },
        relations: ['user'],
      });

      if (!session || session.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (!session.user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }

      this.logger.log({
        message: 'Token refreshed',
        correlationId,
        userId: session.user.id,
      });

      return this.generateAuthResponse(session.user, correlationId);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(sessionId: string, correlationId: string): Promise<void> {
    await this.sessionRepository.update(
      { id: sessionId },
      { isValid: false },
    );

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

    user.password = hashedPassword;
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
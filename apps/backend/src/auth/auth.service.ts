import { ForbiddenException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import bcrypt from '@node-rs/bcrypt';
import type { LoginDto, RegisterDto, ResetPasswordDto, UserDto, VerifyEmailDto } from '@packages/shared-schemas';
import { AuthProvider, User, UserRole } from '../entities/user.entity';
import { EmailService } from '../email/email.service';
import { IssuedTokens, SessionMeta, SessionService } from './session.service';
import { generateToken, hashToken } from './utils/token.util';
import { toUserDto } from './user.mapper';
import type { EnvConfig } from '../env.validation';
import { ORPCError } from '@orpc/server';

const BCRYPT_ROUNDS = 12;
const VERIFY_TTL_MS = 24 * 3600 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export interface AuthResult {
  user: UserDto;
  /** Raw tokens, to be written to httpOnly cookies by the transport layer. Never serialised. */
  tokens: IssuedTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // Compared against when the email is unknown so response time doesn't reveal account existence.
  private dummyHash?: string;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly sessions: SessionService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async register(dto: RegisterDto, meta: SessionMeta, correlationId: string): Promise<AuthResult> {
    const role = (dto.role as UserRole | undefined) ?? UserRole.CUSTOMER;
    if (role === UserRole.ADMIN && !this.config.get('allowAdminSignup', { infer: true })) {
      throw new ForbiddenException('Admin sign-up is disabled');
    }

    const rawVerifyToken = generateToken();
    const user = this.users.create({
      email: dto.email,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      firstName: dto.firstName,
      lastName: dto.lastName,
      role,
      provider: AuthProvider.LOCAL,
      isEmailVerified: false,
      isActive: true,
      emailVerificationToken: hashToken(rawVerifyToken),
      emailVerificationExpires: new Date(Date.now() + VERIFY_TTL_MS),
    });

    let saved: User;
    try {
      saved = await this.users.save(user);
    } catch (err: any) {
      // The unique index is the source of truth; this also covers concurrent signups.
      if (err?.driverError?.code === '23505') throw new ConflictException('An account with that email already exists');
      throw err;
    }

    await this.safeQueue(() =>
      this.emailService.queueEmailVerification(
        { email: saved.email, firstName: saved.firstName, token: rawVerifyToken },
        correlationId,
      ),
    );

    return this.startSession(saved, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthResult> {
    const user = await this.users.findOne({ where: { email: dto.email } });

    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await bcrypt.compare(dto.password, hash);

    //if (!user || !user.passwordHash || !valid) throw new UnauthorizedException('Invalid email or password');
    //if (!user.isActive) throw new UnauthorizedException('This account has been disabled');

    if (!user || !user.passwordHash || !valid) throw new ORPCError('UNAUTHORIZED');
    if (!user.isActive) throw new ORPCError('FORBIDDEN');

    return this.startSession(user, meta);
  }

  /** Shared by password login, registration and OAuth. */
  async startSession(user: User, meta: SessionMeta): Promise<AuthResult> {
    await this.users.update(user.id, { lastLoginAt: new Date() });
    const tokens = await this.sessions.create(user, meta);
    return { user: toUserDto(user), tokens };
  }

  async refresh(rawRefreshToken: string | undefined): Promise<{ user: UserDto; tokens: IssuedTokens | null }> {
    if (!rawRefreshToken) throw new UnauthorizedException('Missing refresh token');
    const { user, tokens } = await this.sessions.rotate(rawRefreshToken);
    return { user: toUserDto(user), tokens };
  }

  async logout(rawAccessToken?: string, rawRefreshToken?: string): Promise<void> {
    await this.sessions.revokeByTokens(rawAccessToken, rawRefreshToken);
  }

  async getMe(userId: string): Promise<UserDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return toUserDto(user);
  }

  async verifyEmail({ token }: VerifyEmailDto): Promise<void> {
    const user = await this.users.findOne({
      where: { emailVerificationToken: hashToken(token), emailVerificationExpires: MoreThan(new Date()) },
    });
    if (!user) throw new BadRequestException('Invalid or expired verification token');

    await this.users.update(user.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });
  }

  /** Always resolves identically so the endpoint can't be used to enumerate accounts. */
  async forgotPassword(email: string, correlationId: string): Promise<void> {
    const user = await this.users.findOne({ where: { email } });
    if (!user || !user.passwordHash || !user.isActive) return;

    const rawToken = generateToken();
    await this.users.update(user.id, {
      passwordResetToken: hashToken(rawToken),
      passwordResetExpires: new Date(Date.now() + RESET_TTL_MS),
    });

    await this.safeQueue(() =>
      this.emailService.queuePasswordReset({ email: user.email, firstName: user.firstName, token: rawToken }, correlationId),
    );
  }

  async resetPassword({ token, newPassword }: ResetPasswordDto): Promise<void> {
    const user = await this.users.findOne({
      where: { passwordResetToken: hashToken(token), passwordResetExpires: MoreThan(new Date()) },
    });
    if (!user) throw new BadRequestException('Invalid or expired reset token');

    await this.users.update(user.id, {
      passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      passwordResetToken: null,
      passwordResetExpires: null,
      isEmailVerified: true, // they just proved control of the mailbox
    });

    // A password reset must kill every existing session (stolen cookies included).
    await this.sessions.revokeAllForUser(user.id);
  }

  private async getDummyHash(): Promise<string> {
    this.dummyHash ??= await bcrypt.hash('timing-equaliser', BCRYPT_ROUNDS);
    return this.dummyHash;
  }

  /** Email delivery must never fail the user-facing operation. */
  private async safeQueue(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`Failed to queue email: ${(err as Error).message}`);
    }
  }
}

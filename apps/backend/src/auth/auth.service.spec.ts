import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import bcrypt from '@node-rs/bcrypt';
import { AuthService } from './auth.service';
import { hashToken } from './utils/token.util';
import { AuthProvider, UserRole, type User } from '../entities/user.entity';

const meta = { ipAddress: '1.2.3.4', userAgent: 'vitest' };
const tokens = { accessToken: 'a', refreshToken: 'r', accessExpiresAt: new Date(), refreshExpiresAt: new Date() };

const makeUser = (over: Partial<User> = {}): User =>
  ({
    id: 'u-1',
    email: 'jane@test.com',
    passwordHash: null,
    firstName: 'Jane',
    lastName: 'Doe',
    role: UserRole.CUSTOMER,
    provider: AuthProvider.LOCAL,
    isEmailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as User;

describe('AuthService', () => {
  let users: { findOne: any; create: any; save: any; update: any };
  let sessions: { create: any; rotate: any; revokeByTokens: any; revokeAllForUser: any };
  let email: { queueEmailVerification: any; queuePasswordReset: any };
  let allowAdminSignup: boolean;
  let service: AuthService;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Secret123', 4); // low cost: this is a unit test
  });

  beforeEach(() => {
    allowAdminSignup = true;
    users = {
      findOne: vi.fn(),
      create: vi.fn((u) => u),
      save: vi.fn(async (u) => ({ id: 'u-new', createdAt: new Date(), updatedAt: new Date(), ...u })),
      update: vi.fn(),
    };
    sessions = {
      create: vi.fn().mockResolvedValue(tokens),
      rotate: vi.fn(),
      revokeByTokens: vi.fn(),
      revokeAllForUser: vi.fn(),
    };
    email = { queueEmailVerification: vi.fn(), queuePasswordReset: vi.fn() };
    const config = { get: vi.fn((key: string) => (key === 'allowAdminSignup' ? allowAdminSignup : undefined)) };
    service = new AuthService(users as any, sessions as any, email as any, config as any);
  });

  describe('register', () => {
    const dto = { email: 'new@test.com', password: 'Secret123', firstName: 'N', lastName: 'U' } as any;

    it('hashes the password, signs the user in, and never returns the hash', async () => {
      const { user, tokens: issued } = await service.register(dto, meta, 'cid');

      const saved = users.create.mock.calls[0][0];
      expect(saved.passwordHash).not.toBe('Secret123');
      expect(await bcrypt.compare('Secret123', saved.passwordHash)).toBe(true);
      expect(user).not.toHaveProperty('passwordHash');
      expect(issued).toBe(tokens);
      expect(sessions.create).toHaveBeenCalledWith(expect.objectContaining({ id: 'u-new' }), meta);
    });

    it('defaults to CUSTOMER, and honours ORGANIZER', async () => {
      await service.register(dto, meta, 'cid');
      expect(users.create.mock.calls[0][0].role).toBe(UserRole.CUSTOMER);

      await service.register({ ...dto, role: 'ORGANIZER' }, meta, 'cid');
      expect(users.create.mock.calls[1][0].role).toBe(UserRole.ORGANIZER);
    });

    it('gates ADMIN sign-up behind the flag, and creates nothing when refused', async () => {
      allowAdminSignup = false;
      await expect(service.register({ ...dto, role: 'ADMIN' }, meta, 'cid')).rejects.toBeInstanceOf(ForbiddenException);
      expect(users.save).not.toHaveBeenCalled();

      allowAdminSignup = true;
      await service.register({ ...dto, role: 'ADMIN' }, meta, 'cid');
      expect(users.create.mock.calls[0][0].role).toBe(UserRole.ADMIN);
    });

    it('emails the RAW verification token but stores only its hash', async () => {
      await service.register(dto, meta, 'cid');

      const stored = users.create.mock.calls[0][0].emailVerificationToken;
      const emailed = email.queueEmailVerification.mock.calls[0][0].token;
      expect(emailed).not.toBe(stored);
      expect(hashToken(emailed)).toBe(stored);
    });

    it('maps a unique-violation (concurrent/duplicate signup) to 409', async () => {
      users.save.mockRejectedValue({ driverError: { code: '23505' } });
      await expect(service.register(dto, meta, 'cid')).rejects.toBeInstanceOf(ConflictException);
      expect(sessions.create).not.toHaveBeenCalled();
    });

    it('does not fail the signup when the verification email cannot be queued', async () => {
      email.queueEmailVerification.mockRejectedValue(new Error('redis down'));
      await expect(service.register(dto, meta, 'cid')).resolves.toBeDefined();
    });
  });

  describe('login', () => {
    const login = { email: 'jane@test.com', password: 'Secret123' };

    it('signs in with the right password and records the login', async () => {
      users.findOne.mockResolvedValue(makeUser({ passwordHash }));
      const { user, tokens: issued } = await service.login(login, meta);

      expect(user.email).toBe('jane@test.com');
      expect(user).not.toHaveProperty('passwordHash');
      expect(issued).toBe(tokens);
      expect(users.update).toHaveBeenCalledWith('u-1', { lastLoginAt: expect.any(Date) });
    });

    // Row factories: the hash is only created in beforeAll, after this table is built.
    it.each([
      ['wrong password', () => makeUser({ passwordHash }), 'Wrong123'],
      ['unknown email', () => null, 'Secret123'],
      ['OAuth-only account (no password)', () => makeUser({ passwordHash: null }), 'Secret123'],
    ])('gives ONE generic error for %s (no account enumeration)', async (_label, makeRow, password) => {
      users.findOne.mockResolvedValue(makeRow());
      const err = await service.login({ ...login, password }, meta).catch((e) => e);

      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('Invalid email or password');
      expect(sessions.create).not.toHaveBeenCalled();
    });

    it('refuses a disabled account even with the right password', async () => {
      users.findOne.mockResolvedValue(makeUser({ passwordHash, isActive: false }));
      await expect(service.login(login, meta)).rejects.toThrow(/disabled/);
      expect(sessions.create).not.toHaveBeenCalled();
    });
  });

  describe('refresh / logout', () => {
    it('rejects a missing refresh token before touching the session store', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessions.rotate).not.toHaveBeenCalled();
    });

    it('returns the user and (possibly null, in the grace window) tokens from rotation', async () => {
      sessions.rotate.mockResolvedValue({ user: makeUser(), sessionId: 's-1', tokens: null });
      const result = await service.refresh('raw-refresh');
      expect(result.tokens).toBeNull();
      expect(result.user.id).toBe('u-1');
    });

    it('logout revokes by whichever tokens were presented', async () => {
      await service.logout('acc', 'ref');
      expect(sessions.revokeByTokens).toHaveBeenCalledWith('acc', 'ref');
    });
  });

  describe('verifyEmail', () => {
    it('looks the token up by its hash and marks the email verified (single use)', async () => {
      users.findOne.mockResolvedValue(makeUser({ isEmailVerified: false }));
      await service.verifyEmail({ token: 'raw-token' });

      expect(users.findOne.mock.calls[0][0].where.emailVerificationToken).toBe(hashToken('raw-token'));
      expect(users.update).toHaveBeenCalledWith('u-1', { isEmailVerified: true, emailVerificationToken: null, emailVerificationExpires: null });
    });

    it('rejects an unknown or expired token', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail({ token: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('forgotPassword', () => {
    it('stores only a hash and emails the raw token', async () => {
      users.findOne.mockResolvedValue(makeUser({ passwordHash }));
      await service.forgotPassword('jane@test.com', 'cid');

      const stored = users.update.mock.calls[0][1].passwordResetToken;
      const emailed = email.queuePasswordReset.mock.calls[0][0].token;
      expect(hashToken(emailed)).toBe(stored);
      expect(users.update.mock.calls[0][1].passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
    });

    it.each([
      ['unknown email', () => null],
      ['OAuth-only account', () => makeUser({ passwordHash: null })],
      ['disabled account', () => makeUser({ passwordHash, isActive: false })],
    ])('silently does nothing for %s, so the endpoint cannot enumerate accounts', async (_label, makeRow) => {
      users.findOne.mockResolvedValue(makeRow());
      await expect(service.forgotPassword('x@test.com', 'cid')).resolves.toBeUndefined();
      expect(email.queuePasswordReset).not.toHaveBeenCalled();
      expect(users.update).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('sets the new password, burns the token, and revokes EVERY session', async () => {
      users.findOne.mockResolvedValue(makeUser({ passwordHash }));
      await service.resetPassword({ token: 'raw-reset', newPassword: 'Brandnew123' });

      expect(users.findOne.mock.calls[0][0].where.passwordResetToken).toBe(hashToken('raw-reset'));
      const patch = users.update.mock.calls[0][1];
      expect(await bcrypt.compare('Brandnew123', patch.passwordHash)).toBe(true);
      expect(patch).toMatchObject({ passwordResetToken: null, passwordResetExpires: null, isEmailVerified: true });
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u-1');
    });

    it('rejects an invalid token without changing anything', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(service.resetPassword({ token: 'bad', newPassword: 'Brandnew123' })).rejects.toBeInstanceOf(BadRequestException);
      expect(users.update).not.toHaveBeenCalled();
      expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    });
  });
});

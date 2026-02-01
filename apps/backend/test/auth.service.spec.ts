import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service';
import { User, UserRole, AuthProvider } from '../src/entities/user.entity';
import { Session } from '../src/entities/session.entity';
import { EmailService } from '../src/email/email.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let sessionRepository: Repository<Session>;
  let jwtService: JwtService;
  let emailService: EmailService;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    password: 'hashed_password',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.CUSTOMER,
    provider: AuthProvider.LOCAL,
    isEmailVerified: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockSessionRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        JWT_ACCESS_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_ACCESS_EXPIRES: '15m',
        JWT_REFRESH_EXPIRES: '7d',
      };
      return config[key];
    }),
  };

  const mockEmailService = {
    queueEmailVerification: jest.fn(),
    queuePasswordReset: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: mockSessionRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    sessionRepository = module.get<Repository<Session>>(getRepositoryToken(Session));
    jwtService = module.get<JwtService>(JwtService);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'Password123!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockSessionRepository.create.mockReturnValue({});
      mockSessionRepository.save.mockResolvedValue({ id: 'session-123' });
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.register(registerDto, 'correlation-123');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockEmailService.queueEmailVerification).toHaveBeenCalled();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it('should throw ConflictException if user already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register(registerDto, 'correlation-123'),
      ).rejects.toThrow(ConflictException);
    });

    it('should hash password before saving', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'Password123!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockSessionRepository.create.mockReturnValue({});
      mockSessionRepository.save.mockResolvedValue({ id: 'session-123' });
      mockJwtService.sign.mockReturnValue('mock-token');

      const bcryptHashSpy = jest.spyOn(bcrypt, 'hash');

      await service.register(registerDto, 'correlation-123');

      expect(bcryptHashSpy).toHaveBeenCalledWith(registerDto.password, 12);
    });
  });

  describe('login', () => {
    it('should login user successfully with valid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const hashedPassword = await bcrypt.hash('Password123!', 12);
      const userWithPassword = { ...mockUser, password: hashedPassword };

      mockUserRepository.findOne.mockResolvedValue(userWithPassword);
      mockUserRepository.save.mockResolvedValue(userWithPassword);
      mockSessionRepository.create.mockReturnValue({});
      mockSessionRepository.save.mockResolvedValue({ id: 'session-123' });
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.login(loginDto, '127.0.0.1', 'test-agent', 'correlation-123');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login(loginDto, '127.0.0.1', 'test-agent', 'correlation-123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword!',
      };

      const hashedPassword = await bcrypt.hash('CorrectPassword!', 12);
      const userWithPassword = { ...mockUser, password: hashedPassword };

      mockUserRepository.findOne.mockResolvedValue(userWithPassword);

      await expect(
        service.login(loginDto, '127.0.0.1', 'test-agent', 'correlation-123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const inactiveUser = { ...mockUser, isActive: false };
      mockUserRepository.findOne.mockResolvedValue(inactiveUser);

      await expect(
        service.login(loginDto, '127.0.0.1', 'test-agent', 'correlation-123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update lastLoginAt on successful login', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const hashedPassword = await bcrypt.hash('Password123!', 12);
      const userWithPassword = { ...mockUser, password: hashedPassword };

      mockUserRepository.findOne.mockResolvedValue(userWithPassword);
      mockUserRepository.save.mockResolvedValue(userWithPassword);
      mockSessionRepository.create.mockReturnValue({});
      mockSessionRepository.save.mockResolvedValue({ id: 'session-123' });
      mockJwtService.sign.mockReturnValue('mock-token');

      await service.login(loginDto, '127.0.0.1', 'test-agent', 'correlation-123');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
        }),
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockSession = {
        id: 'session-123',
        userId: mockUser.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 86400000),
        isValid: true,
        user: mockUser,
      };

      mockJwtService.verify.mockReturnValue({ sub: mockUser.id, sessionId: 'session-123' });
      mockSessionRepository.findOne.mockResolvedValue(mockSession);
      mockSessionRepository.save.mockResolvedValue(mockSession);
      mockJwtService.sign.mockReturnValue('new-mock-token');

      const result = await service.refreshToken(refreshToken, 'correlation-123');

      expect(mockJwtService.verify).toHaveBeenCalledWith(refreshToken, {
        secret: 'test-refresh-secret',
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(refreshToken, 'correlation-123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired session', async () => {
      const refreshToken = 'valid-refresh-token';
      const expiredSession = {
        id: 'session-123',
        userId: mockUser.id,
        refreshToken,
        expiresAt: new Date(Date.now() - 86400000), // Expired
        isValid: true,
        user: mockUser,
      };

      mockJwtService.verify.mockReturnValue({ sub: mockUser.id, sessionId: 'session-123' });
      mockSessionRepository.findOne.mockResolvedValue(expiredSession);

      await expect(service.refreshToken(refreshToken, 'correlation-123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const token = 'valid-verification-token';
      const userToVerify = {
        ...mockUser,
        emailVerificationToken: token,
        emailVerificationExpires: new Date(Date.now() + 86400000),
        isEmailVerified: false,
      };

      mockUserRepository.findOne.mockResolvedValue(userToVerify);
      mockUserRepository.save.mockResolvedValue({ ...userToVerify, isEmailVerified: true });

      await service.verifyEmail(token, 'correlation-123');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        }),
      );
    });

    it('should throw BadRequestException for invalid token', async () => {
      const token = 'invalid-token';

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail(token, 'correlation-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      const token = 'expired-token';
      const userWithExpiredToken = {
        ...mockUser,
        emailVerificationToken: token,
        emailVerificationExpires: new Date(Date.now() - 86400000), // Expired
      };

      mockUserRepository.findOne.mockResolvedValue(userWithExpiredToken);

      await expect(service.verifyEmail(token, 'correlation-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email for existing user', async () => {
      const email = 'test@example.com';

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      await service.forgotPassword(email, 'correlation-123');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordResetToken: expect.any(String),
          passwordResetExpires: expect.any(Date),
        }),
      );
      expect(mockEmailService.queuePasswordReset).toHaveBeenCalled();
    });

    it('should not throw error for non-existent user (security)', async () => {
      const email = 'nonexistent@example.com';

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.forgotPassword(email, 'correlation-123')).resolves.not.toThrow();
      expect(mockEmailService.queuePasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const token = 'valid-reset-token';
      const newPassword = 'NewPassword123!';
      const userWithResetToken = {
        ...mockUser,
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + 86400000),
      };

      mockUserRepository.findOne.mockResolvedValue(userWithResetToken);
      mockUserRepository.save.mockResolvedValue(userWithResetToken);
      mockSessionRepository.update.mockResolvedValue({});

      await service.resetPassword(token, newPassword, 'correlation-123');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordResetToken: null,
          passwordResetExpires: null,
        }),
      );
      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        { userId: mockUser.id },
        { isValid: false },
      );
    });

    it('should throw BadRequestException for invalid reset token', async () => {
      const token = 'invalid-token';
      const newPassword = 'NewPassword123!';

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword(token, newPassword, 'correlation-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('logout', () => {
    it('should invalidate session on logout', async () => {
      const sessionId = 'session-123';

      mockSessionRepository.update.mockResolvedValue({});

      await service.logout(sessionId, 'correlation-123');

      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        { id: sessionId },
        { isValid: false },
      );
    });
  });

  describe('validateUser', () => {
    it('should return user for valid active user', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockUser.id);

      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.validateUser('non-existent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockUserRepository.findOne.mockResolvedValue(inactiveUser);

      await expect(service.validateUser(mockUser.id)).rejects.toThrow(UnauthorizedException);
    });
  });
});
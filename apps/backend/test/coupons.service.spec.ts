import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CouponsService } from '../src/coupons/coupons.service';
import { Coupon, DiscountType } from '../src/entities/coupon.entity';
import Redis from 'ioredis';

describe('CouponsService', () => {
  let service: CouponsService;
  let repository: Repository<Coupon>;
  let redis: Redis;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn(),
    eval: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        {
          provide: getRepositoryToken(Coupon),
          useValue: mockRepository,
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    repository = module.get<Repository<Coupon>>(getRepositoryToken(Coupon));
    redis = module.get<Redis>('default_IORedisModuleConnectionToken');
  });

  describe('validateAndApply', () => {
    it('should apply percentage discount correctly', async () => {
      const mockCoupon = {
        id: 'coupon-123',
        code: 'SAVE20',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
        maxUsages: 100,
        currentUsages: 50,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      } as Coupon;

      mockRedis.set.mockResolvedValue('OK');
      mockRepository.findOne.mockResolvedValue(mockCoupon);
      mockRedis.get.mockResolvedValue('50');
      mockRedis.incr.mockResolvedValue(51);
      mockRepository.save.mockResolvedValue({ ...mockCoupon, currentUsages: 51 });

      const result = await service.validateAndApply(
        { code: 'SAVE20', eventId: 'event-123' },
        100,
        'test-correlation-id',
      );

      expect(result.isValid).toBe(true);
      expect(result.discount).toBe(20);
      expect(result.finalAmount).toBe(80);
    });

    it('should apply fixed discount correctly', async () => {
      const mockCoupon = {
        id: 'coupon-123',
        code: 'FIXED10',
        discountType: DiscountType.FIXED,
        discountValue: 10,
        maxUsages: 100,
        currentUsages: 50,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      } as Coupon;

      mockRedis.set.mockResolvedValue('OK');
      mockRepository.findOne.mockResolvedValue(mockCoupon);
      mockRedis.get.mockResolvedValue('50');
      mockRedis.incr.mockResolvedValue(51);
      mockRepository.save.mockResolvedValue({ ...mockCoupon, currentUsages: 51 });

      const result = await service.validateAndApply(
        { code: 'FIXED10', eventId: 'event-123' },
        100,
        'test-correlation-id',
      );

      expect(result.isValid).toBe(true);
      expect(result.discount).toBe(10);
      expect(result.finalAmount).toBe(90);
    });

    it('should reject expired coupon', async () => {
      const mockCoupon = {
        id: 'coupon-123',
        code: 'EXPIRED',
        isActive: true,
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
      } as Coupon;

      mockRedis.set.mockResolvedValue('OK');
      mockRepository.findOne.mockResolvedValue(mockCoupon);

      const result = await service.validateAndApply(
        { code: 'EXPIRED', eventId: 'event-123' },
        100,
        'test-correlation-id',
      );

      expect(result.isValid).toBe(false);
      expect(result.discount).toBe(0);
    });

    it('should reject coupon when usage limit reached', async () => {
      const mockCoupon = {
        id: 'coupon-123',
        code: 'MAXED',
        maxUsages: 100,
        currentUsages: 100,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
      } as Coupon;

      mockRedis.set.mockResolvedValue('OK');
      mockRepository.findOne.mockResolvedValue(mockCoupon);
      mockRedis.get.mockResolvedValue('100');

      const result = await service.validateAndApply(
        { code: 'MAXED', eventId: 'event-123' },
        100,
        'test-correlation-id',
      );

      expect(result.isValid).toBe(false);
    });
  });
});

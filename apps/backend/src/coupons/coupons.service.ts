import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon, DiscountType } from '../entities/coupon.entity';
import { CreateCouponDto, CouponDto, ApplyCouponDto } from '@event-mgmt/shared-schemas';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);
  private readonly COUPON_LOCK_PREFIX = 'coupon:lock:';
  private readonly COUPON_USAGE_PREFIX = 'coupon:usage:';
  private readonly LOCK_TTL = 5000; // 5 seconds

  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async create(createCouponDto: CreateCouponDto, correlationId: string): Promise<CouponDto> {
    this.logger.log({
      message: 'Creating coupon',
      correlationId,
      code: createCouponDto.code,
    });

    const existingCoupon = await this.couponRepository.findOne({
      where: {
        code: createCouponDto.code,
        eventId: createCouponDto.eventId,
      },
    });

    if (existingCoupon) {
      throw new BadRequestException('Coupon code already exists for this event');
    }

    const coupon = this.couponRepository.create({
      ...createCouponDto,
      expiresAt: new Date(createCouponDto.expiresAt),
      discountType: createCouponDto.discountType as DiscountType,
    });

    const savedCoupon = await this.couponRepository.save(coupon);

    // Initialize Redis counter
    await this.redis.set(
      `${this.COUPON_USAGE_PREFIX}${savedCoupon.id}`,
      '0',
      'EX',
      60 * 60 * 24 * 30, // 30 days TTL
    );

    this.logger.log({
      message: 'Coupon created',
      correlationId,
      couponId: savedCoupon.id,
    });

    return this.toDto(savedCoupon);
  }

  async findByCode(code: string, eventId: string): Promise<CouponDto> {
    const coupon = await this.couponRepository.findOne({
      where: { code: code.toUpperCase(), eventId, isActive: true },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return this.toDto(coupon);
  }

  async validateAndApply(
    applyCouponDto: ApplyCouponDto,
    amount: number,
    correlationId: string,
  ): Promise<{
    isValid: boolean;
    discount: number;
    finalAmount: number;
    coupon?: CouponDto;
  }> {
    const lockKey = `${this.COUPON_LOCK_PREFIX}${applyCouponDto.code}:${applyCouponDto.eventId}`;
    const lockValue = `${correlationId}:${Date.now()}`;

    // Distributed lock with retry
    const lock = await this.acquireLock(lockKey, lockValue, 3);

    if (!lock) {
      this.logger.warn({
        message: 'Failed to acquire coupon lock',
        correlationId,
        code: applyCouponDto.code,
      });
      throw new BadRequestException('Coupon is currently being processed, please try again');
    }

    try {
      const coupon = await this.couponRepository.findOne({
        where: {
          code: applyCouponDto.code.toUpperCase(),
          eventId: applyCouponDto.eventId,
          isActive: true,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!coupon) {
        return { isValid: false, discount: 0, finalAmount: amount };
      }

      // Check expiration
      if (new Date(coupon.expiresAt) < new Date()) {
        this.logger.warn({
          message: 'Coupon expired',
          correlationId,
          code: applyCouponDto.code,
        });
        return { isValid: false, discount: 0, finalAmount: amount };
      }

      // Check minimum purchase amount
      if (coupon.minPurchaseAmount && amount < Number(coupon.minPurchaseAmount)) {
        this.logger.warn({
          message: 'Minimum purchase amount not met',
          correlationId,
          code: applyCouponDto.code,
          required: coupon.minPurchaseAmount,
          actual: amount,
        });
        return { isValid: false, discount: 0, finalAmount: amount };
      }

      // Check usage limit with Redis atomic operation
      const usageKey = `${this.COUPON_USAGE_PREFIX}${coupon.id}`;
      const currentUsage = await this.redis.get(usageKey);
      const usage = currentUsage ? parseInt(currentUsage) : coupon.currentUsages;

      if (usage >= coupon.maxUsages) {
        this.logger.warn({
          message: 'Coupon usage limit reached',
          correlationId,
          code: applyCouponDto.code,
          usage,
          maxUsages: coupon.maxUsages,
        });
        return { isValid: false, discount: 0, finalAmount: amount };
      }

      // Calculate discount
      let discount = 0;
      if (coupon.discountType === DiscountType.PERCENTAGE) {
        discount = (amount * Number(coupon.discountValue)) / 100;
      } else {
        discount = Number(coupon.discountValue);
      }

      const finalAmount = Math.max(0, amount - discount);

      // Increment usage atomically in Redis
      await this.redis.incr(usageKey);

      // Update database usage (eventual consistency is acceptable here)
      coupon.currentUsages += 1;
      await this.couponRepository.save(coupon);

      this.logger.log({
        message: 'Coupon applied successfully',
        correlationId,
        code: applyCouponDto.code,
        discount,
        originalAmount: amount,
        finalAmount,
      });

      return {
        isValid: true,
        discount,
        finalAmount,
        coupon: this.toDto(coupon),
      };
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  async revertUsage(couponCode: string, eventId: string, correlationId: string): Promise<void> {
    const coupon = await this.couponRepository.findOne({
      where: { code: couponCode.toUpperCase(), eventId },
    });

    if (!coupon) {
      return;
    }

    const usageKey = `${this.COUPON_USAGE_PREFIX}${coupon.id}`;
    await this.redis.decr(usageKey);

    coupon.currentUsages = Math.max(0, coupon.currentUsages - 1);
    await this.couponRepository.save(coupon);

    this.logger.log({
      message: 'Coupon usage reverted',
      correlationId,
      code: couponCode,
    });
  }

  private async acquireLock(key: string, value: string, retries: number): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      const result = await this.redis.set(key, value, 'PX', this.LOCK_TTL, 'NX');
      if (result === 'OK') {
        return true;
      }
      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, i)));
    }
    return false;
  }

  private async releaseLock(key: string, value: string): Promise<void> {
    const redisReleaseLockScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(redisReleaseLockScript, 1, key, value);
  }

  private toDto(coupon: Coupon): CouponDto {
    return {
      id: coupon.id,
      code: coupon.code,
      eventId: coupon.eventId,
      // discountType: coupon.discountType as any,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      maxUsages: coupon.maxUsages,
      currentUsages: coupon.currentUsages,
      expiresAt: coupon.expiresAt.toISOString(),
      minPurchaseAmount: coupon.minPurchaseAmount ? Number(coupon.minPurchaseAmount) : undefined,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
    };
  }
}

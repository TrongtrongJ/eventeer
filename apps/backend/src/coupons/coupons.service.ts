import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { CouponDto, CreateCouponDto, UpdateCouponDto } from '@packages/shared-schemas';
import { Coupon, DiscountType } from '../entities/coupon.entity';
import { Event } from '../entities/event.entity';
import { UserRole } from '../entities/user.entity';
import { ResourceNotFoundException } from '../common/exceptions/business.exception';
import { fromCents, toCents } from '../common/money';

export interface Redemption {
  code: string;
  discountCents: number;
}

export const normalizeCouponCode = (code: string) => code.trim().toUpperCase();

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    @InjectRepository(Coupon) private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(Event) private readonly eventRepository: Repository<Event>,
  ) {}

  async create(dto: CreateCouponDto, userId: string, role: string, correlationId: string): Promise<CouponDto> {
    const event = await this.getManageableEvent(dto.eventId, userId, role);

    // Never trust the client-supplied `eventTicketPrice`: validate against the real price.
    if (dto.discountType === DiscountType.FIXED && dto.discountValue > Number(event.ticketPrice)) {
      throw new BadRequestException('Discount amount cannot exceed the ticket price');
    }
    if (new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('Expiry date must be in the future');
    }

    const code = normalizeCouponCode(dto.code);
    const duplicate = await this.couponRepository.exists({ where: { code, eventId: event.id } });
    if (duplicate) throw new ConflictException('A coupon with this code already exists for this event');

    const saved = await this.couponRepository.save(
      this.couponRepository.create({
        code,
        eventId: event.id,
        discountType: dto.discountType as DiscountType,
        discountValue: dto.discountValue,
        maxUsages: dto.maxUsages,
        expiresAt: new Date(dto.expiresAt),
        minPurchaseAmount: dto.minPurchaseAmount,
        isActive: true,
      }),
    );

    this.logger.log({ message: 'Coupon created', correlationId, couponId: saved.id, eventId: event.id });
    return this.toDto({ ...saved, event });
  }

  async findByEvent(eventId: string, userId: string, role: string): Promise<CouponDto[]> {
    await this.getManageableEvent(eventId, userId, role);
    const coupons = await this.couponRepository.find({
      where: { eventId },
      relations: { event: true },
      order: { createdAt: 'DESC' },
    });
    return coupons.map((c) => this.toDto(c));
  }

  /** Public: lets the checkout UI preview a code. Only returns coupons that are currently redeemable. */
  async findByCode(rawCode: string, eventId: string): Promise<CouponDto> {
    const coupon = await this.couponRepository.findOne({
      where: { code: normalizeCouponCode(rawCode), eventId },
      relations: { event: true },
    });
    if (!coupon || !this.isRedeemable(coupon)) throw new NotFoundException('Coupon not found or no longer valid');
    return this.toDto(coupon);
  }

  async update(id: string, dto: UpdateCouponDto, userId: string, role: string, correlationId: string): Promise<CouponDto> {
    const coupon = await this.couponRepository.findOne({ where: { id }, relations: { event: true } });
    if (!coupon) throw new ResourceNotFoundException('Coupon', id);
    await this.getManageableEvent(coupon.eventId, userId, role);

    coupon.isActive = dto.isActive;
    const saved = await this.couponRepository.save(coupon);
    this.logger.log({ message: 'Coupon updated', correlationId, couponId: id, isActive: saved.isActive });
    return this.toDto(saved);
  }

  // ── Used by BookingsService, always inside the booking transaction ────────

  /**
   * Validates and redeems a coupon. The usage increment is ONE conditional UPDATE
   * (`currentUsages < maxUsages`), so concurrent redemptions cannot exceed the cap
   * and, being in the booking's transaction, the increment rolls back with it.
   */
  async redeem(manager: EntityManager, rawCode: string, eventId: string, totalCents: number): Promise<Redemption> {
    const code = normalizeCouponCode(rawCode);
    const coupon = await manager.findOne(Coupon, { where: { code, eventId } });

    if (!coupon || !this.isRedeemable(coupon)) {
      throw new BadRequestException('Invalid or expired coupon code');
    }
    if (coupon.minPurchaseAmount != null && totalCents < toCents(coupon.minPurchaseAmount)) {
      throw new BadRequestException(`A minimum purchase of ${Number(coupon.minPurchaseAmount).toFixed(2)} is required for this coupon`);
    }

    const claimed = await manager
      .createQueryBuilder()
      .update(Coupon)
      .set({ currentUsages: () => '"currentUsages" + 1' })
      .where('id = :id AND "isActive" = true AND "expiresAt" > now() AND "currentUsages" < "maxUsages"', { id: coupon.id })
      .execute();
    if (claimed.affected !== 1) throw new BadRequestException('This coupon has reached its usage limit');

    const value = Number(coupon.discountValue);
    const raw = coupon.discountType === DiscountType.PERCENTAGE ? Math.round((totalCents * value) / 100) : toCents(value);
    return { code, discountCents: Math.min(raw, totalCents) };
  }

  /** Gives a usage back when a booking is cancelled/expired. */
  async release(manager: EntityManager, rawCode: string, eventId: string): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(Coupon)
      .set({ currentUsages: () => 'GREATEST(0, "currentUsages" - 1)' })
      .where('code = :code AND "eventId" = :eventId', { code: normalizeCouponCode(rawCode), eventId })
      .execute();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private isRedeemable(c: Coupon): boolean {
    return c.isActive && c.expiresAt > new Date() && c.currentUsages < c.maxUsages;
  }

  private async getManageableEvent(eventId: string, userId: string, role: string): Promise<Event> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) throw new ResourceNotFoundException('Event', eventId);
    if (role !== UserRole.ADMIN && event.organizerId !== userId) {
      throw new ForbiddenException('You can only manage coupons for your own events');
    }
    return event;
  }

  private toDto(coupon: Coupon): CouponDto {
    return {
      id: coupon.id,
      code: coupon.code,
      eventId: coupon.eventId,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      maxUsages: coupon.maxUsages,
      currentUsages: coupon.currentUsages,
      expiresAt: coupon.expiresAt.toISOString(),
      minPurchaseAmount: coupon.minPurchaseAmount != null ? Number(coupon.minPurchaseAmount) : undefined,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
      eventTicketPrice: Number(coupon.event.ticketPrice),
    } as CouponDto;
  }
}

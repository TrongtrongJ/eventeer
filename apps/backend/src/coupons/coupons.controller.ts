import { 
  Controller, 
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { UserRole } from '../entities/user.entity';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { couponContract } from '@packages/contract';
import { withCorrelationId } from '../common/middleware/correlation-id.middleware';
import { withCurrentUser } from '../common/middleware/current-user.middleware';
import { requireRoles } from '../common/middleware/require-roles.middleware';
import { Public } from '../auth/decorators/public.decorator';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Implement(couponContract.createCoupon)
  async create() {
    return implement(couponContract.createCoupon)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .use(requireRoles([UserRole.ORGANIZER, UserRole.ADMIN]))
      .handler(async ({ input, context }) => {
        const { user, correlationId } = context;
        const coupon = await this.couponsService.create(
          input, 
          user.userId,
          user.role,
          correlationId
        );
        return {
          success: true,
          data: coupon,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(couponContract.getEventCoupons)
  async getEventCoupons() {
    return implement(couponContract.getEventCoupons)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .use(requireRoles([UserRole.ORGANIZER, UserRole.ADMIN]))
      .handler(async ({ input, context }) => {
        const { eventId } = input;
        const { user, correlationId } = context;
        const coupons = await this.couponsService.findByEvent(
          eventId,
          user.userId,
          user.role,
        );
        return {
          success: true,
          data: coupons,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Public()
  @Implement(couponContract.getCoupon)
  async getCoupon() {
    return implement(couponContract.getCoupon)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { params: { code }, query: { eventId } } = input;
        const { correlationId } = context;
        const coupon = await this.couponsService.findByCode(code, eventId);
        return {
          success: true,
          data: coupon,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(couponContract.updateCoupon)
  async updateCoupon() {
    return implement(couponContract.updateCoupon)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ input, context }) => {
        const { params: { id }, body } = input;
        const { user, correlationId } = context;
        const coupon = await this.couponsService.update(
          id,
          body,
          user.userId,
          user.role,
          correlationId,
        );
        return {
          success: true,
          data: coupon,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }
}

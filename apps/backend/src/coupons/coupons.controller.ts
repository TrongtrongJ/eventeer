import { 
  Controller, 
  Post, 
  Get, 
  Patch,
  Body, 
  Param, 
  Query, 
  Req, 
  HttpCode, 
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { 
  CreateCouponDto, 
  CreateCouponSchema 
} from '@event-mgmt/shared-schemas';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreateCouponSchema)) createCouponDto: CreateCouponDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: any,
  ) {
    const coupon = await this.couponsService.create(
      createCouponDto, 
      user.userId,
      user.role,
      req.correlationId
    );
    return {
      success: true,
      data: coupon,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('event/:eventId')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async getEventCoupons(
    @Param('eventId') eventId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: any,
  ) {
    const coupons = await this.couponsService.findByEvent(
      eventId,
      user.userId,
      user.role,
    );
    return {
      success: true,
      data: coupons,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get(':code')
  async findByCode(
    @Param('code') code: string,
    @Query('eventId') eventId: string,
    @Req() req: any,
  ) {
    const coupon = await this.couponsService.findByCode(code, eventId);
    return {
      success: true,
      data: coupon,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async update(
    @Param('id') id: string,
    @Body() updateData: { isActive?: boolean },
    @CurrentUser() user: CurrentUserData,
    @Req() req: any,
  ) {
    const coupon = await this.couponsService.update(
      id,
      updateData,
      user.userId,
      user.role,
      req.correlationId,
    );
    return {
      success: true,
      data: coupon,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }
}

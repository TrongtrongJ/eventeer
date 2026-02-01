import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, CreateCouponSchema } from '@event-mgmt/shared-schemas';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreateCouponSchema))
    createCouponDto: CreateCouponDto,
    @Req() req: any,
  ) {
    const coupon = await this.couponsService.create(createCouponDto, req.correlationId);
    return {
      success: true,
      data: coupon,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

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
}

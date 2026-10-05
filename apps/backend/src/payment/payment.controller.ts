import {
  Controller,
  Post,
  Body,
  Headers,
  type RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Request } from 'express';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    this.paymentService.parseWebhook(signature, request.rawBody!);
    return { received: true };
  }
}

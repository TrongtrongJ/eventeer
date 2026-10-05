import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentService } from '../payment/payment.service';
import { BookingsService } from './bookings.service';

/**
 * Lives in the bookings module (not payment) so PaymentModule stays a leaf with no
 * dependency on the booking domain. The body is a raw Buffer here, set up in
 * app.setup.ts, because Stripe signs the exact bytes it sent.
 */
@Public()
@Controller('payment')
export class PaymentWebhookController {
  constructor(
    private readonly payments: PaymentService,
    private readonly bookings: BookingsService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handle(@Headers('stripe-signature') signature: string | undefined, @Req() req: Request) {
    const event = this.payments.parseWebhook(signature, req.body as Buffer);
    if (event) await this.bookings.handlePaymentEvent(event);
    return { received: true };
  }
}

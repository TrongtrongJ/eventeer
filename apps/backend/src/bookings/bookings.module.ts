import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { BookingsService } from './bookings.service';
import { BookingsResolver } from './bookings.resolver';
import { Booking } from '../entities/booking.entity';
import { EventsModule } from '../events/events.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentModule } from '../payment/payment.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), EventsModule, CouponsModule, PaymentModule, EmailModule],
  controllers: [BookingsController, PaymentWebhookController],
  providers: [BookingsService, BookingsResolver],
  exports: [BookingsService],
})
export class BookingsModule {}

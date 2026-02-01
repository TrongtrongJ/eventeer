import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingsResolver } from './bookings.resolver'; // ADD THIS
import { Booking } from '../entities/booking.entity';
import { Ticket } from '../entities/ticket.entity';
import { Event } from '../entities/event.entity';
import { EventsModule } from '../events/events.module';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentModule } from '../payment/payment.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Ticket, Event]),
    EventsModule,
    CouponsModule,
    PaymentModule,
    EmailModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsResolver], // ADD BookingsResolver
  exports: [BookingsService],
})
export class BookingsModule {}
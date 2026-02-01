import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingType } from '../graphql/types/booking.type';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CreateBookingDto } from '@event-mgmt/shared-schemas';

@Resolver(() => BookingType)
export class BookingsResolver {
  constructor(private readonly bookingsService: BookingsService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => BookingType, { name: 'booking' })
  async getBooking(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: any,
  ): Promise<BookingType> {
    const userId = context.req.user.userId;
    const booking = await this.bookingsService.findOne(id);

    // Check ownership
    if (booking.userId !== userId && context.req.user.role !== 'ADMIN') {
      throw new Error('You can only view your own bookings');
    }

    return booking as any;
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [BookingType], { name: 'myBookings' })
  async getMyBookings(@Context() context: any): Promise<BookingType[]> {
    const userId = context.req.user.userId;
    const bookings = await this.bookingsService.findByUser(userId);
    return bookings as any;
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => BookingType)
  async createBooking(
    @Args('eventId', { type: () => ID }) eventId: string,
    @Args('quantity') quantity: number,
    @Args('firstName') firstName: string,
    @Args('lastName') lastName: string,
    @Args('email') email: string,
    @Args('couponCode', { nullable: true }) couponCode: string,
    @Context() context: any,
  ): Promise<BookingType> {
    const userId = context.req.user.userId;
    const correlationId = context.req.correlationId || 'graphql-mutation';

    const bookingDto: CreateBookingDto = {
      eventId,
      quantity,
      firstName,
      lastName,
      email,
      couponCode: couponCode || undefined,
    };

    const booking = await this.bookingsService.create(bookingDto, userId, correlationId);
    return booking as any;
  }
}

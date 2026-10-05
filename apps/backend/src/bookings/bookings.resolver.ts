import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { BadRequestException } from '@nestjs/common';
import { CreateBookingSchema, type CurrentUserData } from '@packages/shared-schemas';
import { BookingsService } from './bookings.service';
import { BookingType } from '../graphql/types/booking.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { randomUUID } from 'crypto';

/** Auth is enforced by the global guards (default-deny); ownership by BookingsService. */
@Resolver(() => BookingType)
export class BookingsResolver {
  constructor(private readonly bookingsService: BookingsService) {}

  @Query(() => BookingType, { name: 'booking' })
  async getBooking(@Args('id', { type: () => ID }) id: string, @CurrentUser() user: CurrentUserData) {
    return (await this.bookingsService.findOneFor(id, user)) as unknown as BookingType;
  }

  @Query(() => [BookingType], { name: 'myBookings' })
  async getMyBookings(@CurrentUser() user: CurrentUserData) {
    return (await this.bookingsService.findByUser(user.userId)) as unknown as BookingType[];
  }

  @Mutation(() => BookingType)
  async createBooking(
    @Args('eventId', { type: () => ID }) eventId: string,
    @Args('quantity', { type: () => Int }) quantity: number,
    @Args('firstName') firstName: string,
    @Args('lastName') lastName: string,
    @Args('email') email: string,
    @Args('couponCode', { type: () => String, nullable: true }) couponCode: string | undefined,
    @CurrentUser() user: CurrentUserData,
  ) {
    // Same validation rules as REST: one shared Zod schema.
    const parsed = CreateBookingSchema.safeParse({ eventId, quantity, firstName, lastName, email, couponCode: couponCode || undefined });
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid booking');

    return (await this.bookingsService.create(parsed.data, user.userId, randomUUID())) as unknown as BookingType;
  }
}

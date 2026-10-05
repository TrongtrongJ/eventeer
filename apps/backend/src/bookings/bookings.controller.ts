import { Controller } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { bookingContract } from '@packages/contract';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { withCorrelationId } from '../common/middleware/correlation-id.middleware';
import { withCurrentUser } from '../common/middleware/current-user.middleware';
import { requireRoles } from '../common/middleware/require-roles.middleware';
import { BookingsService } from './bookings.service';

const ok = <T>(data: T, correlationId: string) => ({
  success: true as const,
  data,
  correlationId,
  timestamp: new Date().toISOString(),
});

/**
 * Thin transport layer. Ownership / role rules live in BookingsService so the
 * REST and GraphQL surfaces cannot drift apart.
 */
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Creating a booking takes inventory; keep scripted hoarding in check.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Implement(bookingContract.createBooking)
  async createBooking() {
    return implement(bookingContract.createBooking)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ input, context }) => {
        const { user, correlationId } = context;
        const booking = await this.bookingsService.create(input, user.userId, correlationId);
        return ok(booking, correlationId);
      });
  }

  @Implement(bookingContract.confirmBooking)
  async confirmBooking() {
    return implement(bookingContract.confirmBooking)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ input, context }) => {
        const { user, correlationId } = context;
        const booking = await this.bookingsService.confirmBooking(input.id, user, correlationId);
        return ok(booking, correlationId);
      });
  }

  @Implement(bookingContract.findOne)
  async findOne() {
    return implement(bookingContract.findOne)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ input, context }) => {
        const booking = await this.bookingsService.findOneFor(input.id, context.user);
        return ok(booking, context.correlationId);
      });
  }

  @Implement(bookingContract.getMyBookings)
  async getMyBookings() {
    return implement(bookingContract.getMyBookings)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ context }) => {
        const bookings = await this.bookingsService.findByUser(context.user.userId);
        return ok(bookings, context.correlationId);
      });
  }

  @Implement(bookingContract.cancelBooking)
  async cancelBooking() {
    return implement(bookingContract.cancelBooking)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ input, context }) => {
        const { user, correlationId } = context;
        await this.bookingsService.cancelBooking(input.id, user, correlationId);
        return ok(null, correlationId);
      });
  }

  @Roles(UserRole.ADMIN)
  @Implement(bookingContract.adminListBookings)
  async adminListBookings() {
    return implement(bookingContract.adminListBookings)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .use(requireRoles([UserRole.ADMIN]))
      .handler(async ({ context }) => ok(await this.bookingsService.findAll(), context.correlationId));
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Implement(bookingContract.getEventBookings)
  async getEventBookings() {
    return implement(bookingContract.getEventBookings)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .use(requireRoles([UserRole.ORGANIZER, UserRole.ADMIN]))
      .handler(async ({ input, context }) => {
        const bookings = await this.bookingsService.findByEvent(input.eventId, context.user);
        return ok(bookings, context.correlationId);
      });
  }
}

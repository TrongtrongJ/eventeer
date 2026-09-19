import {
  Controller,
  Get,
  Delete,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { bookingContract } from '@packages/contract';
import { withCorrelationId } from '../common/middleware/correlation-id.middleware';
import { withCurrentUser } from '../common/middleware/current-user.middleware';
import { requireRoles } from '../common/middleware/require-roles.middleware';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Implement(bookingContract.createBooking)
  async createBooking() {
    return implement(bookingContract.createBooking)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ input, context }) => {
        const { user, correlationId } = context;
        const booking = await this.bookingsService.create(
          input,
          user.userId,
          correlationId,
        );
        return {
          success: true,
          data: booking,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(bookingContract.confirmBooking)
  async confirmBooking() {
    return implement(bookingContract.confirmBooking)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ input, context }) => {
        const { id } = input;
        const { user, correlationId } = context;
        // Verify booking belongs to user
        const existingBooking = await this.bookingsService.findOne(id);
        if (existingBooking.userId !== user.userId) {
          throw new ForbiddenException('You can only confirm your own bookings');
        }

        const booking = await this.bookingsService.confirmBooking(id, correlationId);
        return {
          success: true,
          data: booking,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(bookingContract.findOne)
  async findOne() {
    return implement(bookingContract.findOne)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ input, context }) => {
        const { id } = input;
        const { user, correlationId } = context;
        const booking = await this.bookingsService.findOne(id);

        // Check if user owns this booking or is admin
        if (booking.userId !== user.userId && user.role !== UserRole.ADMIN) {
          throw new ForbiddenException('You can only view your own bookings');
        }

        return {
          success: true,
          data: booking,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(bookingContract.getMyBookings)
  async getMyBookings() {
    return implement(bookingContract.getMyBookings)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ context }) => {
        const { user, correlationId } = context;
        const bookings = await this.bookingsService.findByUser(user.userId);
        return {
          success: true,
          data: bookings,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(bookingContract.cancelBooking)
  async cancelBooking() {
    return implement(bookingContract.cancelBooking)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .handler(async ({ input, context }) => {
        const { id } = input;
        const { user, correlationId } = context;
        const booking = await this.bookingsService.findOne(id);
        if (booking.userId !== user.userId && user.role !== UserRole.ADMIN) {
          throw new ForbiddenException('You can only cancel your own bookings');
        }

        await this.bookingsService.cancelBooking(id, correlationId);
        return {
          success: true,
          data: null,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(bookingContract.adminListBookings)
  async adminListBookings() {
    return implement(bookingContract.adminListBookings)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .use(requireRoles([UserRole.ADMIN]))
      .handler(async ({ context }) => {
        const { correlationId } = context;
        const bookings = await this.bookingsService.findAll();
        return {
          success: true,
          data: bookings,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(bookingContract.getEventBookings)
  async getEventBookings() {
    return implement(bookingContract.getEventBookings)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .use(requireRoles([UserRole.ORGANIZER, UserRole.ADMIN]))
      .handler(async ({ input, context }) => {
        const { eventId } = input;
        const { user, correlationId } = context;
        const bookings = await this.bookingsService.findByEvent(eventId, user.userId, user.role);
        return {
          success: true,
          data: bookings,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }
}

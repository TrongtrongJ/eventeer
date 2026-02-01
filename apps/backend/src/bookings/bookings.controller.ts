import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, BookingSchema, CreateBookingSchema } from '@event-mgmt/shared-schemas';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(CreateBookingSchema)) createBookingDto: CreateBookingDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: any,
  ) {
    const booking = await this.bookingsService.create(
      createBookingDto,
      user.userId,
      req.correlationId,
    );
    return {
      success: true,
      data: booking,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/confirm')
  async confirm(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: any) {
    // Verify booking belongs to user
    const existingBooking = await this.bookingsService.findOne(id);
    if (existingBooking.userId !== user.userId) {
      throw new ForbiddenException('You can only confirm your own bookings');
    }

    const booking = await this.bookingsService.confirmBooking(id, req.correlationId);
    return {
      success: true,
      data: booking,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: any) {
    const booking = await this.bookingsService.findOne(id);

    // Check if user owns this booking or is admin
    if (booking.userId !== user.userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only view your own bookings');
    }

    return {
      success: true,
      data: booking,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('my/bookings')
  async getMyBookings(@CurrentUser() user: CurrentUserData, @Req() req: any) {
    const bookings = await this.bookingsService.findByUser(user.userId);
    return {
      success: true,
      data: bookings,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: any) {
    // Verify booking belongs to user
    const booking = await this.bookingsService.findOne(id);
    if (booking.userId !== user.userId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only cancel your own bookings');
    }

    await this.bookingsService.cancelBooking(id, req.correlationId);
  }

  // Admin endpoint to view all bookings
  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async getAllBookings(@Req() req: any) {
    const bookings = await this.bookingsService.findAll();
    return {
      success: true,
      data: bookings,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  // Organizer endpoint to view bookings for their events
  @Get('event/:eventId/bookings')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  async getEventBookings(
    @Param('eventId') eventId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: any,
  ) {
    const bookings = await this.bookingsService.findByEvent(eventId, user.userId, user.role);
    return {
      success: true,
      data: bookings,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { EventsService, EventFilters } from './events.service';
import {
  CreateEventDto,
  UpdateEventDto,
  CreateEventSchema,
  UpdateEventSchema,
} from '@event-mgmt/shared-schemas';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new event' })
  async create(
    @Body(new ZodValidationPipe(CreateEventSchema)) createEventDto: CreateEventDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: any,
  ) {
    const event = await this.eventsService.create(createEventDto, user.userId, req.correlationId);
    return {
      success: true,
      data: event,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all events with pagination and filtering' })
  @ApiPaginatedResponse(Object)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'availableOnly', required: false, type: Boolean })
  async findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('location') location?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('availableOnly') availableOnly?: boolean | string,
    @Req() req?: any,
  ) {
    const filters: EventFilters = {
      location,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      startDate,
      endDate,
      availableOnly: availableOnly === true || availableOnly === 'true',
    };

    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
    const result = await this.eventsService.findAllPaginated(pagination, filters, baseUrl);

    return {
      success: true,
      ...result,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const event = await this.eventsService.findOne(id, req.correlationId);
    return {
      success: true,
      data: event,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('my/events')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get current user events' })
  async getMyEvents(@CurrentUser() user: CurrentUserData, @Req() req: any) {
    const events = await this.eventsService.findByOrganizer(user.userId);
    return {
      success: true,
      data: events,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update event' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateEventSchema)) updateEventDto: UpdateEventDto,
    @CurrentUser() user: CurrentUserData,
    @Req() req: any,
  ) {
    if (user.role !== UserRole.ADMIN) {
      const event = await this.eventsService.findOne(id, req.correlationId);
      if (event.organizerId !== user.userId) {
        throw new ForbiddenException('You can only update your own events');
      }
    }

    const event = await this.eventsService.update(id, updateEventDto, req.correlationId);
    return {
      success: true,
      data: event,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete event' })
  async delete(@Param('id') id: string, @CurrentUser() user: CurrentUserData, @Req() req: any) {
    if (user.role !== UserRole.ADMIN) {
      const event = await this.eventsService.findOne(id, req.correlationId);
      if (event.organizerId !== user.userId) {
        throw new ForbiddenException('You can only delete your own events');
      }
    }

    await this.eventsService.delete(id, req.correlationId);
  }
}

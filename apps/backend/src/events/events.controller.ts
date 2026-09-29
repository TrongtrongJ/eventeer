import {
  Controller,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EventsService, EventFilters } from './events.service';
import { UserRole } from '../entities/user.entity';
import { Implement } from '@orpc/nest';
import { eventContract } from '@packages/contract';
import { implement } from '@orpc/server';
import { withCorrelationId } from '../common/middleware/correlation-id.middleware';
import { withCurrentUser } from '../common/middleware/current-user.middleware';
import { requireRoles } from '../common/middleware/require-roles.middleware';
import { withBaseUrl } from '../common/middleware/base-url.middleware';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Implement(eventContract.create)
  async create() {
    return implement(eventContract.create)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .use(requireRoles([UserRole.ORGANIZER, UserRole.ADMIN]))
      .handler(async ({ input, context }) => {
        const { user, correlationId } = context;
        const event = await this.eventsService.create(input, user.userId, correlationId);
        return {
          success: true,
          data: event,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  /*@Post()
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
  } */

  @Public()
  @Implement(eventContract.findAll)
  async findAll() {
    return implement(eventContract.findAll)
      .use(withCorrelationId)
      .use(withBaseUrl)
      .handler(async ({ input, context }) => {
        const { pagination, location, minPrice, maxPrice, startDate, endDate, availableOnly } = input;
        const { correlationId, baseUrl } = context;
        const filters: EventFilters = {
          location: location,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          startDate: startDate,
          endDate: endDate,
          availableOnly: availableOnly === true,
        };

        const result = await this.eventsService.findAllPaginated(pagination, filters, baseUrl);

        return {
          success: true,
          ...result,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }


  /* @Public()
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
  } */

  @Implement(eventContract.findOne)
  async findOne() {
    return implement(eventContract.findOne)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { correlationId } = context;
        const event = await this.eventsService.findOne(input.id, correlationId);
        return {
          success: true,
          data: event,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }
  
  /*@Public()
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
  }*/

  @Implement(eventContract.getMyEvents)
  async getMyEvents() {
    return implement(eventContract.getMyEvents)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .use(requireRoles([UserRole.ORGANIZER, UserRole.ADMIN]))
      .handler(async ({ context }) => {
        const { user, correlationId } = context;
        const events = await this.eventsService.findByOrganizer(user.userId);
        return {
          success: true,
          data: events,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  /* @Get('my/events')
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
  } */

  @Implement(eventContract.updateEvent)
  async updateEvent() {
    return implement(eventContract.updateEvent)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .use(requireRoles([UserRole.ORGANIZER, UserRole.ADMIN]))
      .handler(async ({ input, context }) => {
        const { user, correlationId } = context;
        
        if (user.role !== UserRole.ADMIN) {
          const event = await this.eventsService.findOne(input.params.id, correlationId);
          if (event.organizerId !== user.userId) {
            throw new ForbiddenException('You can only update your own events');
          }
        }

        const event = await this.eventsService.update(input.params.id, input.body, correlationId);
        return {
          success: true,
          data: event,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  /*@Put(':id')
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
  }*/

  @Implement(eventContract.deleteEvent)
  async deleteEvent() {
    return implement(eventContract.deleteEvent)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .use(requireRoles([UserRole.ORGANIZER, UserRole.ADMIN]))
      .handler(async ({ input, context }) => {
        const { id } = input;
        const { user, correlationId } = context;
        if (user.role !== UserRole.ADMIN) {
          const event = await this.eventsService.findOne(id, correlationId);
          if (event.organizerId !== user.userId) {
            throw new ForbiddenException('You can only delete your own events');
          }
        }

        await this.eventsService.delete(id, correlationId);

        return {
          success: true,
          data: null,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        }
      });
  }

  /*@Delete(':id')
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

    return {
      success: true,
      data: null,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    }
  }*/
}

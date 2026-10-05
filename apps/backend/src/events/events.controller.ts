import {
  Controller,
  ForbiddenException,
} from '@nestjs/common';
import { EventsService, EventFilters } from './events.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { Implement } from '@orpc/nest';
import { eventContract } from '@packages/contract';
import { implement } from '@orpc/server';
import { withCorrelationId } from '../common/middleware/correlation-id.middleware';
import { withCurrentUser } from '../common/middleware/current-user.middleware';
import { requireRoles } from '../common/middleware/require-roles.middleware';
import { Public } from '../auth/decorators/public.decorator';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
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

  @Public()
  @Implement(eventContract.findAll)
  async findAll() {
    return implement(eventContract.findAll)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { pagination, location, minPrice, maxPrice, startDate, endDate, availableOnly } = input;
        const { correlationId } = context;
        const filters: EventFilters = {
          location: location,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          startDate: startDate,
          endDate: endDate,
          availableOnly: availableOnly === true,
        };

        const result = await this.eventsService.findAllPaginated(pagination, filters);

        return {
          success: true,
          ...result,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Public()
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

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
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

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
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

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
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
}

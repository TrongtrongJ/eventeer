import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventType } from '../graphql/types/event.type';
import { PaginatedEventsType } from '../graphql/inputs/paginated-events.type';
import { CreateEventInput } from '../graphql/inputs/create-event.input';
import { EventFiltersInput } from '../graphql/inputs/event-filters.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlRolesGuard } from '../auth/guards/gql-roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';
import { SortOrder } from 'src/common/dto/pagination.dto';

@Resolver(() => EventType)
export class EventsResolver {
  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Query(() => PaginatedEventsType, { name: 'events' })
  async getEvents(
    @Args('filters', { nullable: true }) filters?: EventFiltersInput,
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    
    const events = await this.eventsService.findAllPaginated({
      page,
      limit,
      search: filters?.search,
      // location: filters?.location,
      sortBy: filters?.sortBy || 'startDate',
      sortOrder: filters?.sortOrder || SortOrder.ASC,
    }, {});

    return events;
  }

  @Public()
  @Query(() => EventType, { name: 'event' })
  async getEvent(@Args('id', { type: () => ID }) id: string): Promise<EventType> {
    const event = await this.eventsService.findOne(id);
    return event as any;
  }

  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Mutation(() => EventType)
  async createEvent(
    @Args('input') input: CreateEventInput,
    @Context() context: any,
  ): Promise<EventType> {
    const userId = context.req.user.userId;
    const correlationId = context.req.correlationId || 'graphql-mutation';
    
    const event = await this.eventsService.create(
      {
        ...input,
        currency: input.currency as any,
      },
      userId,
      correlationId,
    );

    return event as any;
  }

  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Mutation(() => Boolean)
  async deleteEvent(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.userId;
    const userRole = context.req.user.role;
    const correlationId = context.req.correlationId || 'graphql-mutation';

    // Check ownership
    if (userRole !== UserRole.ADMIN) {
      const event = await this.eventsService.findOne(id, correlationId);
      if (event.organizerId !== userId) {
        throw new Error('You can only delete your own events');
      }
    }

    await this.eventsService.delete(id, correlationId);
    return true;
  }
}
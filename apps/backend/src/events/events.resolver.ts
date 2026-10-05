import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateEventSchema, type CurrentUserData } from '@packages/shared-schemas';
import { EventsService } from './events.service';
import { EventType } from '../graphql/types/event.type';
import { PaginatedEventsType } from '../graphql/inputs/paginated-events.type';
import { CreateEventInput } from '../graphql/inputs/create-event.input';
import { EventFiltersInput } from '../graphql/inputs/event-filters.input';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../entities/user.entity';

@Resolver(() => EventType)
export class EventsResolver {
  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Query(() => PaginatedEventsType, { name: 'events' })
  async getEvents(@Args('filters', { nullable: true }) filters?: EventFiltersInput) {
    const result = await this.eventsService.findAllPaginated(
      {
        page: filters?.page ?? 1,
        limit: Math.min(filters?.limit ?? 10, 100),
        search: filters?.search,
        sortBy: filters?.sortBy ?? 'startDate',
        sortOrder: filters?.sortOrder ?? 'DESC',
      },
      {},
    );
    return {
      events: result.data as unknown as EventType[],
      total: result.meta.total,
      page: result.meta.page,
      limit: result.meta.limit,
      totalPages: result.meta.totalPages,
      hasMore: result.meta.hasNextPage,
    };
  }

  @Public()
  @Query(() => EventType, { name: 'event' })
  async getEvent(@Args('id', { type: () => ID }) id: string) {
    return (await this.eventsService.findOne(id)) as unknown as EventType;
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Mutation(() => EventType)
  async createEvent(@Args('input') input: CreateEventInput, @CurrentUser() user: CurrentUserData) {
    const parsed = CreateEventSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid event');

    return (await this.eventsService.create(parsed.data, user.userId, randomUUID())) as unknown as EventType;
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Mutation(() => Boolean)
  async deleteEvent(@Args('id', { type: () => ID }) id: string, @CurrentUser() user: CurrentUserData) {
    if (user.role !== UserRole.ADMIN) {
      const event = await this.eventsService.findOne(id);
      if (event.organizerId !== user.userId) throw new ForbiddenException('You can only delete your own events');
    }
    await this.eventsService.delete(id, randomUUID());
    return true;
  }
}

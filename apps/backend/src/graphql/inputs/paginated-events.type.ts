import { ObjectType, Field, Int } from '@nestjs/graphql';
import { EventType } from '../types/event.type';

@ObjectType()
export class PaginatedEventsType {
  @Field(() => [EventType])
  events: EventType[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field()
  hasMore: boolean;
}
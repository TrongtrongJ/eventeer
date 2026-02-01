import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class EventType {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  location: string;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field(() => Int)
  capacity: number;

  @Field(() => Int)
  availableSeats: number;

  @Field(() => Float)
  ticketPrice: number;

  @Field()
  currency: string;

  @Field({ nullable: true })
  imageUrl?: string;

  @Field({ nullable: true })
  organizerId?: string;

  @Field({ nullable: true })
  organizerName?: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
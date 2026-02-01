import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class TicketType {
  @Field(() => ID)
  id: string;

  @Field()
  ticketNumber: string;

  @Field()
  qrCode: string;

  @Field()
  isValidated: boolean;

  @Field({ nullable: true })
  validatedAt?: string;
}

@ObjectType()
export class BookingType {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  eventId: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => Int)
  quantity: number;

  @Field()
  email: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field(() => Float)
  totalAmount: number;

  @Field(() => Float)
  finalAmount: number;

  @Field(() => Float)
  discount: number;

  @Field({ nullable: true })
  couponCode?: string;

  @Field()
  status: string;

  @Field(() => [TicketType])
  tickets: TicketType[];

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}

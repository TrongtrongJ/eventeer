import { InputType, Field, Float, Int } from '@nestjs/graphql';

/** Shape only. Validation is done once, with the shared Zod CreateEventSchema, in the resolver. */
@InputType()
export class CreateEventInput {
  @Field() title: string;
  @Field() description: string;
  @Field() location: string;
  @Field() startDate: string;
  @Field() endDate: string;
  @Field(() => Int) capacity: number;
  @Field(() => Float) ticketPrice: number;
  @Field({ defaultValue: 'THB' }) currency: string;
  @Field({ nullable: true }) imageUrl?: string;
}

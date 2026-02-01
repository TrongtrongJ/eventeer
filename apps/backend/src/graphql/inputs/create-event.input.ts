import { InputType, Field, Float, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsNumber, IsDateString, IsUrl, Min, Max } from 'class-validator';

@InputType()
export class CreateEventInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  title: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  description: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  location: string;

  @Field()
  @IsDateString()
  startDate: string;

  @Field()
  @IsDateString()
  endDate: string;

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  @Max(100000)
  capacity: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  ticketPrice: number;

  @Field({ defaultValue: 'USD' })
  @IsString()
  currency: string;

  @Field({ nullable: true })
  @IsUrl()
  imageUrl?: string;
}

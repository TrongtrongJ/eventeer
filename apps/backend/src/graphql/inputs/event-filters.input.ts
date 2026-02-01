import { InputType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { SortOrder } from 'src/common/dto/pagination.dto';

registerEnumType(SortOrder, {
  name: 'SortOrder',
  description: 'Sort order direction',
});

@InputType()
export class EventFiltersInput {
  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 10 })
  limit?: number;

  @Field({ nullable: true })
  search?: string;

  /*@Field({ nullable: true })
  location?: string;*/

  @Field({ nullable: true })
  sortBy?: string;

  @Field(() => SortOrder, { nullable: true, defaultValue: SortOrder.ASC })
  sortOrder?: SortOrder;
}
import { InputType, Field, Int, registerEnumType } from '@nestjs/graphql';

enum SortOrderEnum {
  ASC = "ASC",
  DESC = "DESC"
}
registerEnumType(SortOrderEnum, {
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

  @Field(() => SortOrderEnum, { nullable: true, defaultValue: SortOrderEnum.ASC })
  sortOrder?: SortOrderEnum;
}
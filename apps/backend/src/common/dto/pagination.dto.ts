import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsEnum, Min, Max, IsString } from 'class-validator';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;

  @IsOptional()
  @IsString()
  search?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationLinks {
  first: string;
  previous: string | null;
  next: string | null;
  last: string;
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMeta;
  links: PaginationLinks;

  constructor(data: T[], total: number, page: number, limit: number, baseUrl: string) {
    this.data = data;

    const totalPages = Math.ceil(total / limit);
    this.meta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    this.links = {
      first: `${baseUrl}?page=1&limit=${limit}`,
      previous: page > 1 ? `${baseUrl}?page=${page - 1}&limit=${limit}` : null,
      next: page < totalPages ? `${baseUrl}?page=${page + 1}&limit=${limit}` : null,
      last: `${baseUrl}?page=${totalPages}&limit=${limit}`,
    };
  }
}

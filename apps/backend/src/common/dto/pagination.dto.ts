import { type SortOrder, sortOrder } from '@packages/shared-schemas';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsEnum, Min, Max, IsString } from 'class-validator';

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
  @IsEnum(sortOrder)
  sortOrder?: SortOrder = 'DESC';

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

export function buildPaginatedResponse<T>(data: T[], total: number, page: number, limit: number, baseUrl: string) {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    links: {
      first: `${baseUrl}?page=1&limit=${limit}`,
      previous: page > 1 ? `${baseUrl}?page=${page - 1}&limit=${limit}` : null,
      next: page < totalPages ? `${baseUrl}?page=${page + 1}&limit=${limit}` : null,
      last: `${baseUrl}?page=${totalPages}&limit=${limit}`,
    },
  }
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

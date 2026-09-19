import { z } from 'zod';

const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

const PaginationLinksSchema = z.object({
  first: z.string(),
  previous: z.string().nullable(),
  next: z.string().nullable(),
  last: z.string(),
});

export function createPaginatedResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    meta: PaginationMetaSchema,
    links: PaginationLinksSchema,
    success: z.boolean(),
    correlationId: z.string(),
    timestamp: z.iso.datetime(),
  });
}
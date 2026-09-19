import z from "zod";
import { sortOrder } from './const';
export const entityCreateSchema = z.object({
    createdAt: z.iso.datetime(),
    createBy: z.string(),
});

export const entityUpdateSchema = z.object({
    updatedAt: z.iso.datetime(),
    updatedBy: z.string(),
});

export const entityDeleteSchema = z.object({
    isDeleted: z.boolean(),
    deletedAt: z.iso.datetime().optional(),
    deletedBy: z.string().optional(),
});

export const basePaginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    
    sortBy: z.string().optional(),
    sortOrder: z.enum(sortOrder).default('DESC'),
    search: z.string().optional(),
});

export const createBaseResponse = <T extends z.ZodTypeAny>(dataSchema: T) => {
  return z.object({
    success: z.boolean(),
    data: dataSchema,
    correlationId: z.string(),
    timestamp: z.iso.datetime(),
  })
}

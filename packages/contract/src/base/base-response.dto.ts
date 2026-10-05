import { z } from 'zod';
export function createBaseResponse<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.boolean(),
    data: dataSchema,
    correlationId: z.string(),
    timestamp: z.iso.datetime(),
  });
};

export const responseWithNullData = createBaseResponse(z.null())
export const responseWithMessage = createBaseResponse(z.object({
  message: z.string()
}))

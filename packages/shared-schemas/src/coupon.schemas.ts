import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Coupon Schemas
export const CreateCouponSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  eventId: z.string().uuid(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive(),
  maxUsages: z.number().int().positive().max(10000),
  expiresAt: z.string().datetime(),
  minPurchaseAmount: z.number().min(0).optional(),
});

export const CouponSchema = CreateCouponSchema.extend({
  id: z.string().uuid(),
  currentUsages: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ApplyCouponSchema = z.object({
  code: z.string().min(3).max(50),
  eventId: z.string().uuid(),
});

export type CreateCouponDto = z.infer<typeof CreateCouponSchema>;
export type CouponDto = z.infer<typeof CouponSchema>;
export type ApplyCouponDto = z.infer<typeof ApplyCouponSchema>;

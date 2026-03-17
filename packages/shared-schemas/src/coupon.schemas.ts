import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Coupon Schemas
const BaseCouponSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  eventId: z.string().uuid(),
  maxUsages: z.number().int().positive().max(10000),
  expiresAt: z.string().datetime(),
  minPurchaseAmount: z.number().min(0).optional(),
  eventTicketPrice: z.number().min(0) // hidden field
});

const discountType = ['PERCENTAGE', 'FIXED'] as const;
export type DiscountType = typeof discountType[number];

const CouponDiscountSchema = z.discriminatedUnion('discountType', [
  z.object({
    discountType: z.literal(discountType[0]),
    discountValue: z.number()
      .min(1, "Discount percentage cannot be 0%")
      .max(100, "Discount percentage cannot exceed 100%"),
  }),
  z.object({
    discountType: z.literal(discountType[1]),
    discountValue: z.number()
      .min(1, "Discount amount cannot be 0")
  })
]);

export const CreateCouponSchema = z.intersection(BaseCouponSchema, CouponDiscountSchema)
  .refine((data) => data.discountValue >= data.eventTicketPrice, {
    message: 'Discount amount cannot exceed ticket price',
    path: ['discountValue']
  });
/* export const CreateCouponSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  eventId: z.string().uuid(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().positive(),
  maxUsages: z.number().int().positive().max(10000),
  expiresAt: z.string().datetime(),
  minPurchaseAmount: z.number().min(0).optional(),
}); */

/* export const CouponSchema = CreateCouponSchema.extend({
  id: z.string().uuid(),
  currentUsages: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});*/
export const CouponSchema = z.intersection(CreateCouponSchema, z.object({
  id: z.string().uuid(),
  currentUsages: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}));

export const ApplyCouponSchema = z.object({
  code: z.string().min(3).max(50),
  eventId: z.string().uuid(),
});

export type CreateCouponDto = z.infer<typeof CreateCouponSchema>;
export type CouponDto = z.infer<typeof CouponSchema>;
export type ApplyCouponDto = z.infer<typeof ApplyCouponSchema>;

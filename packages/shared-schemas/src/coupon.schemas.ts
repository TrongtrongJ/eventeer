import { z } from "zod";

// Coupon Schemas
const BaseCouponSchema = z.object({
  code: z.string().min(3).max(50).toUpperCase(),
  eventId: z.uuid(),
  maxUsages: z.number().int().positive().max(10000),
  expiresAt: z.iso.datetime(),
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

export const CreateCouponSchema = BaseCouponSchema.and(CouponDiscountSchema)
  .refine(
  (data) => {
    if (data.discountType === 'FIXED') {
      return data.discountValue <= data.eventTicketPrice;
    }
    return true; 
  }, 
  {
    message: 'Discount amount cannot exceed ticket price',
    path: ['discountValue']
  }
);

export const CouponSchema = CreateCouponSchema.and(z.object({
  id: z.uuid(),
  currentUsages: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}));

export const ApplyCouponSchema = z.object({
  code: z.string().min(3).max(50),
  eventId: z.uuid(),
});

export const UpdateCouponSchema = z.object({
  isActive: z.boolean(),
})

export type CreateCouponDto = z.infer<typeof CreateCouponSchema>;
export type UpdateCouponDto = z.infer<typeof UpdateCouponSchema>;
export type CouponDto = z.infer<typeof CouponSchema>;
export type ApplyCouponDto = z.infer<typeof ApplyCouponSchema>;

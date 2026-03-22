import { z } from "zod";
declare const discountType: readonly ["PERCENTAGE", "FIXED"];
export type DiscountType = typeof discountType[number];
export declare const CreateCouponSchema: z.ZodEffects<z.ZodIntersection<z.ZodObject<{
    code: z.ZodString;
    eventId: z.ZodString;
    maxUsages: z.ZodNumber;
    expiresAt: z.ZodString;
    minPurchaseAmount: z.ZodOptional<z.ZodNumber>;
    eventTicketPrice: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    code?: string;
    eventId?: string;
    maxUsages?: number;
    expiresAt?: string;
    minPurchaseAmount?: number;
    eventTicketPrice?: number;
}, {
    code?: string;
    eventId?: string;
    maxUsages?: number;
    expiresAt?: string;
    minPurchaseAmount?: number;
    eventTicketPrice?: number;
}>, z.ZodDiscriminatedUnion<"discountType", [z.ZodObject<{
    discountType: z.ZodLiteral<"PERCENTAGE">;
    discountValue: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    discountType?: "PERCENTAGE";
    discountValue?: number;
}, {
    discountType?: "PERCENTAGE";
    discountValue?: number;
}>, z.ZodObject<{
    discountType: z.ZodLiteral<"FIXED">;
    discountValue: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    discountType?: "FIXED";
    discountValue?: number;
}, {
    discountType?: "FIXED";
    discountValue?: number;
}>]>>, {
    code?: string;
    eventId?: string;
    maxUsages?: number;
    expiresAt?: string;
    minPurchaseAmount?: number;
    eventTicketPrice?: number;
} & ({
    discountType?: "PERCENTAGE";
    discountValue?: number;
} | {
    discountType?: "FIXED";
    discountValue?: number;
}), {
    code?: string;
    eventId?: string;
    maxUsages?: number;
    expiresAt?: string;
    minPurchaseAmount?: number;
    eventTicketPrice?: number;
} & ({
    discountType?: "PERCENTAGE";
    discountValue?: number;
} | {
    discountType?: "FIXED";
    discountValue?: number;
})>;
export declare const CouponSchema: z.ZodIntersection<z.ZodEffects<z.ZodIntersection<z.ZodObject<{
    code: z.ZodString;
    eventId: z.ZodString;
    maxUsages: z.ZodNumber;
    expiresAt: z.ZodString;
    minPurchaseAmount: z.ZodOptional<z.ZodNumber>;
    eventTicketPrice: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    code?: string;
    eventId?: string;
    maxUsages?: number;
    expiresAt?: string;
    minPurchaseAmount?: number;
    eventTicketPrice?: number;
}, {
    code?: string;
    eventId?: string;
    maxUsages?: number;
    expiresAt?: string;
    minPurchaseAmount?: number;
    eventTicketPrice?: number;
}>, z.ZodDiscriminatedUnion<"discountType", [z.ZodObject<{
    discountType: z.ZodLiteral<"PERCENTAGE">;
    discountValue: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    discountType?: "PERCENTAGE";
    discountValue?: number;
}, {
    discountType?: "PERCENTAGE";
    discountValue?: number;
}>, z.ZodObject<{
    discountType: z.ZodLiteral<"FIXED">;
    discountValue: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    discountType?: "FIXED";
    discountValue?: number;
}, {
    discountType?: "FIXED";
    discountValue?: number;
}>]>>, {
    code?: string;
    eventId?: string;
    maxUsages?: number;
    expiresAt?: string;
    minPurchaseAmount?: number;
    eventTicketPrice?: number;
} & ({
    discountType?: "PERCENTAGE";
    discountValue?: number;
} | {
    discountType?: "FIXED";
    discountValue?: number;
}), {
    code?: string;
    eventId?: string;
    maxUsages?: number;
    expiresAt?: string;
    minPurchaseAmount?: number;
    eventTicketPrice?: number;
} & ({
    discountType?: "PERCENTAGE";
    discountValue?: number;
} | {
    discountType?: "FIXED";
    discountValue?: number;
})>, z.ZodObject<{
    id: z.ZodString;
    currentUsages: z.ZodNumber;
    isActive: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id?: string;
    currentUsages?: number;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
}, {
    id?: string;
    currentUsages?: number;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
}>>;
export declare const ApplyCouponSchema: z.ZodObject<{
    code: z.ZodString;
    eventId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code?: string;
    eventId?: string;
}, {
    code?: string;
    eventId?: string;
}>;
export type CreateCouponDto = z.infer<typeof CreateCouponSchema>;
export type CouponDto = z.infer<typeof CouponSchema>;
export type ApplyCouponDto = z.infer<typeof ApplyCouponSchema>;
export {};

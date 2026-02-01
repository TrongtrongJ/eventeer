import { z } from "zod";
export declare const CreateCouponSchema: z.ZodObject<{
    code: z.ZodString;
    eventId: z.ZodString;
    discountType: z.ZodEnum<["PERCENTAGE", "FIXED"]>;
    discountValue: z.ZodNumber;
    maxUsages: z.ZodNumber;
    expiresAt: z.ZodString;
    minPurchaseAmount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    code?: string;
    eventId?: string;
    discountType?: "PERCENTAGE" | "FIXED";
    discountValue?: number;
    maxUsages?: number;
    expiresAt?: string;
    minPurchaseAmount?: number;
}, {
    code?: string;
    eventId?: string;
    discountType?: "PERCENTAGE" | "FIXED";
    discountValue?: number;
    maxUsages?: number;
    expiresAt?: string;
    minPurchaseAmount?: number;
}>;
export declare const CouponSchema: z.ZodObject<{
    expiresAt: z.ZodString;
    eventId: z.ZodString;
    code: z.ZodString;
    discountType: z.ZodEnum<["PERCENTAGE", "FIXED"]>;
    discountValue: z.ZodNumber;
    maxUsages: z.ZodNumber;
    minPurchaseAmount: z.ZodOptional<z.ZodNumber>;
    id: z.ZodString;
    currentUsages: z.ZodNumber;
    isActive: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    expiresAt?: string;
    eventId?: string;
    code?: string;
    discountType?: "PERCENTAGE" | "FIXED";
    discountValue?: number;
    maxUsages?: number;
    minPurchaseAmount?: number;
    id?: string;
    currentUsages?: number;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
}, {
    expiresAt?: string;
    eventId?: string;
    code?: string;
    discountType?: "PERCENTAGE" | "FIXED";
    discountValue?: number;
    maxUsages?: number;
    minPurchaseAmount?: number;
    id?: string;
    currentUsages?: number;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
}>;
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

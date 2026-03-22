import { z } from "zod";
export declare const CreatePaymentIntentSchema: z.ZodObject<{
    bookingId: z.ZodString;
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodEnum<["USD", "EUR", "GBP"]>>;
}, "strip", z.ZodTypeAny, {
    bookingId?: string;
    amount?: number;
    currency?: "USD" | "EUR" | "GBP";
}, {
    bookingId?: string;
    amount?: number;
    currency?: "USD" | "EUR" | "GBP";
}>;
export type CreatePaymentIntentDto = z.infer<typeof CreatePaymentIntentSchema>;

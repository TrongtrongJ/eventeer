import { z } from "zod";

// Payment Schema
export const CreatePaymentIntentSchema = z.object({
  bookingId: z.uuid(),
  amount: z.number().positive(),
  currency: z.enum(["USD", "EUR", "GBP"]).default("USD"),
});

export type CreatePaymentIntentDto = z.infer<typeof CreatePaymentIntentSchema>;

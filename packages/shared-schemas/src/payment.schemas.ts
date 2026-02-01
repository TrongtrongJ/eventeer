import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Payment Schema
export const CreatePaymentIntentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.enum(["USD", "EUR", "GBP"]).default("USD"),
});

export type CreatePaymentIntentDto = z.infer<typeof CreatePaymentIntentSchema>;

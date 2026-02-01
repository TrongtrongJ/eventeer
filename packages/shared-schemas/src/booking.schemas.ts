import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const CreateBookingSchema = z.object({
  eventId: z.string().uuid(),
  quantity: z.number().int().positive().max(20),
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  couponCode: z.string().optional(),
});

export const BookingSchema = CreateBookingSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid().optional(),
  totalAmount: z.number().positive(),
  finalAmount: z.number().positive(),
  discount: z.number().min(0),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "FAILED"]),
  paymentIntentId: z.string().optional(),
  tickets: z.array(
    z.object({
      id: z.string().uuid(),
      ticketNumber: z.string(),
      qrCode: z.string(),
      isValidated: z.boolean(),
      validatedAt: z.string().datetime().nullable(),
    })
  ),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
export type BookingDto = z.infer<typeof BookingSchema>;

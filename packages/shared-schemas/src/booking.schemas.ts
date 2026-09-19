import { z } from "zod";

const bookingStatus = ["PENDING", "CONFIRMED", "CANCELLED", "FAILED"] as const
export type BookingStatus = typeof bookingStatus[number]
export const CreateBookingSchema = z.object({
  eventId: z.uuid(),
  quantity: z.number().int().positive().max(20),
  email: z.email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  couponCode: z.string().optional(),
});

export const BookingSchema = CreateBookingSchema.extend({
  id: z.uuid(),
  userId: z.uuid().optional(),
  totalAmount: z.number().positive(),
  finalAmount: z.number().positive(),
  discount: z.number().min(0),
  status: z.enum(bookingStatus),
  paymentIntentId: z.string().optional(),
  clientSecret: z.string().optional(),
  tickets: z.array(
    z.object({
      id: z.uuid(),
      ticketNumber: z.string(),
      qrCode: z.string(),
      isValidated: z.boolean(),
      validatedAt: z.string().datetime().nullable(),
    })
  ),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
export type BookingDto = z.infer<typeof BookingSchema>;

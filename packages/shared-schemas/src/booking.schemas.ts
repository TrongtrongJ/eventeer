import { z } from "zod";

const bookingStatus = ["PENDING", "CONFIRMED", "CANCELLED", "FAILED", "EXPIRED"] as const
export type BookingStatus = typeof bookingStatus[number]
export const CreateBookingSchema = z.object({
  eventId: z.uuid(),
  quantity: z.number().int().positive().max(20),
  email: z.email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  couponCode: z.string().trim().max(50).optional(),
});

export const BookingSchema = CreateBookingSchema.extend({
  id: z.uuid(),
  userId: z.uuid().optional(),
  // Non-negative: free events and 100%-off coupons legitimately produce 0.
  /** ISO currency of the event (e.g. THB); drives money formatting in the UI. */
  currency: z.string().length(3).optional(),
  totalAmount: z.number().nonnegative(),
  finalAmount: z.number().nonnegative(),
  discount: z.number().min(0),
  status: z.enum(bookingStatus),
  paymentIntentId: z.string().optional(),
  /** Only present for the owner of a PENDING booking; never in list/admin views. */
  clientSecret: z.string().optional(),
  /** PENDING bookings hold seats until this instant, then are released. */
  expiresAt: z.iso.datetime().nullable().optional(),
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

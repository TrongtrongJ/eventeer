import { z } from "zod";
export * from "./event.schemas";
export * from "./booking.schemas";
export * from "./coupon.schemas";
export * from "./auth.schemas";
export * from "./payment.schemas";
export * from "./ticket-validation.schemas";
export * from "./pagination.schemas";
export * from "./user.schemas";

// WebSocket Event Types
export const SeatAvailabilityUpdateSchema = z.object({
  eventId: z.string().uuid(),
  availableSeats: z.number().int().min(0),
  capacity: z.number().int().positive(),
  timestamp: z.string().datetime(),
});

export type SeatAvailabilityUpdate = z.infer<
  typeof SeatAvailabilityUpdateSchema
>;

// API Response Wrapper
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    correlationId: z.string().uuid(),
    timestamp: z.string().datetime(),
  });

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  correlationId: string;
  timestamp: string;
};

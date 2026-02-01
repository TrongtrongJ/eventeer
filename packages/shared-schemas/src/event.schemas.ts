import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Event Schemas
export const CreateEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  location: z.string().min(3).max(500),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  capacity: z.number().int().positive().max(100000),
  ticketPrice: z.number().positive().max(1000000),
  currency: z.enum(["USD", "EUR", "GBP"]).default("USD"),
  imageUrl: z.string().url().optional(),
});

export const UpdateEventSchema = CreateEventSchema.partial();

export const EventSchema = CreateEventSchema.extend({
  id: z.string().uuid(),
  organizerId: z.string().uuid().optional(),
  organizerName: z.string().optional(),
  availableSeats: z.number().int().min(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateEventDto = z.infer<typeof CreateEventSchema>;
export type UpdateEventDto = z.infer<typeof UpdateEventSchema>;
export type EventDto = z.infer<typeof EventSchema>;

import { z } from "zod";
import { inputAwareDateTime } from "./constants";
import { basePaginationSchema } from "./base/entity.schemas";

export const currency = ["THB", "USD", "EUR", "GBP"] as const;

export type Currency = typeof currency[number];
  
// Event Schemas
export const CreateEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  location: z.string().min(3).max(500),
  startDate: inputAwareDateTime(),
  endDate: inputAwareDateTime(),
  capacity: z.number().int().positive().max(100000),
  ticketPrice: z.number().nonnegative().max(1000000),
  currency: z.enum(currency).optional().default(currency[0]),
  imageUrl: z.url().or(z.literal('')).optional(),
});

export const UpdateEventSchema = CreateEventSchema.partial();

export const EventSchema = CreateEventSchema.extend({
  id: z.uuid(),
  organizerId: z.uuid().optional(),
  organizerName: z.string().optional(),
  availableSeats: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const EventQuerySchema = z.object({
  pagination: basePaginationSchema,
  
  location: z.string().optional(),
  
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
  
  availableOnly: z.coerce.boolean().optional(),
});

export type CreateEventDto = z.infer<typeof CreateEventSchema>;
export type UpdateEventDto = z.infer<typeof UpdateEventSchema>;
export type EventDto = z.infer<typeof EventSchema>;
export type EventQueryDto = z.infer<typeof EventQuerySchema>;

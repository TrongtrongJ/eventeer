import { z } from "zod";

// Ticket Validation Schema
export const EventTicketDataSchema = z.object({
  id: z.string(),
  ticketNumber: z.string().optional(),
  isValidated: z.boolean(),
  validatedAt: z.iso.datetime().optional(),
  eventTitle: z.string(),
  eventDate: z.iso.datetime(),
  holderName: z.string(),
})
export const ValidateTicketSchema = z.object({
  ticketId: z.uuid(),
  qrCode: z.string().min(10),
});

export const ValidatedTicketData = EventTicketDataSchema.pick({
  ticketNumber: true,
  eventTitle: true,
  holderName: true,
  validatedAt: true,
}).partial();

export const ValidateTicketResSchema = z.object({
  isValid: z.boolean(),
  message: z.string(),
  ticket: ValidatedTicketData.optional(),
})

export const TicketLookupResSchema = EventTicketDataSchema.optional();
export type ValidateTicketDto = z.infer<typeof ValidateTicketSchema>;
export type ValidateTicketResDto = z.infer<typeof ValidateTicketResSchema>;
export type EventTicketDataDto = z.infer<typeof EventTicketDataSchema>;
export type TicketLookupResDto = z.infer<typeof TicketLookupResSchema>;

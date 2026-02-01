import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Ticket Validation Schema
export const ValidateTicketSchema = z.object({
  ticketId: z.string().uuid(),
  qrCode: z.string().min(10),
});

export type ValidateTicketDto = z.infer<typeof ValidateTicketSchema>;

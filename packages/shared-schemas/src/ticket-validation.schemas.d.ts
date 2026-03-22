import { z } from "zod";
export declare const ValidateTicketSchema: z.ZodObject<{
    ticketId: z.ZodString;
    qrCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ticketId?: string;
    qrCode?: string;
}, {
    ticketId?: string;
    qrCode?: string;
}>;
export type ValidateTicketDto = z.infer<typeof ValidateTicketSchema>;

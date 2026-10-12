import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { TicketLookupResSchema, ValidateTicketResSchema, ValidateTicketSchema } from "@packages/shared-schemas";
import { createBaseResponse } from "./base/base-response.dto";

export const ticketContract = oc.router({
    validate: oc
        .input(ValidateTicketSchema)
        .output(createBaseResponse(ValidateTicketResSchema))
        .meta(
            openapi({
                method: "POST",
                path: "/tickets/validate",
                description: "Validate ticket with QR code",
                tags: ["Ticket"],
            }),
        ),
    lookup: oc
        .input(ValidateTicketSchema)
        .output(createBaseResponse(TicketLookupResSchema))
        .meta(
            openapi({
                method: "GET",
                path: "/tickets/lookup",
                description: "Lookup ticket data with QR code",
                tags: ["Ticket"],
            }),
        ),
});

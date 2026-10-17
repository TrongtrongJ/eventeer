import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import {
    EventSchema,
    CreateEventSchema,
    EventQuerySchema,
    UpdateEventSchema,
    CreateEventImageUploadSchema,
    EventImageUploadSchema,
} from "@packages/shared-schemas";
import { createBaseResponse } from "./base/base-response.dto";
import { createPaginatedResponse } from "./base/base-pagination.dto";

export const eventContract = oc.router({
    create: oc
        .input(CreateEventSchema)
        .output(createBaseResponse(EventSchema))
        .meta(
            openapi({
                method: "POST",
                path: "/events",
                description: "Create new event",
                tags: ["Event"],
            }),
        ),
    createImageUpload: oc
        .input(CreateEventImageUploadSchema)
        .output(createBaseResponse(EventImageUploadSchema))
        .errors({
          SERVICE_UNAVAILABLE: {
            message: "Image uploads are not configured",
          },
        })
        .meta(
            openapi({
                method: "POST",
                path: "/events/image-upload",
                description: "Get a short-lived presigned POST for uploading an event image straight to S3",
                tags: ["Event"],
            }),
        ),
    findAll: oc
        .input(EventQuerySchema)
        .output(createPaginatedResponse(EventSchema))
        .meta(
            openapi({
                method: "GET",
                path: "/events",
                description: "List events with filters and pagination",
                tags: ["Event"],
            }),
        ),
    findOne: oc
        .input(
            z.object({
                id: z.uuid(),
            }),
        )
        .output(createBaseResponse(EventSchema))
        .errors({
          NOT_FOUND: {
            message: `Event with ID '{id}' not found`,
          }
        })
        .meta(
            openapi({
                method: "GET",
                path: "/events/{id}",
                description: "Get event item by id",
                tags: ["Event"],
            }),
        ),
    getMyEvents: oc.output(createBaseResponse(z.array(EventSchema))).meta(
        openapi({
            method: "GET",
            path: "/events/my/events",
            description: "Get current user events",
            tags: ["Event"],
        }),
    ),
    updateEvent: oc
        .input(
            z.object({
                params: z.object({ id: z.uuid() }),
                body: UpdateEventSchema,
            }),
        )
        .output(createBaseResponse(EventSchema))
        .errors({
          NOT_FOUND: {
            message: `Event with ID '{id}' not found`,
          },
          BAD_REQUEST: {
            message: `Capacity cannot be lower than the {sold} seats already booked`
          }
        })
        .meta(
            openapi({
                method: "PUT",
                path: "/events/{id}",
                description: "Update event by id",
                inputStructure: "detailed",
                tags: ["Event"],
            }),
        ),
    deleteEvent: oc
        .input(
            z.object({
                id: z.uuid(),
            }),
        )
        .output(createBaseResponse(z.null()))
        .errors({
          NOT_FOUND: {
            message: `Event with ID '{id}' not found`,
          },
          CONFLICT: {
            message: "This event has bookings and cannot be deleted"
          }
        })
        .meta(
            openapi({
                method: "DELETE",
                path: "/events/{id}",
                description: "Delete event by id",
                tags: ["Event"],
            }),
        ),
});

import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";
import { BookingSchema, CreateBookingSchema } from "@packages/shared-schemas";
import { createBaseResponse } from "./base/base-response.dto";

export const bookingContract = oc.router({
    createBooking: oc
        .input(CreateBookingSchema)
        .output(createBaseResponse(BookingSchema))
        .meta(
            openapi({
                method: "POST",
                path: "/bookings/create",
                description: "Create booking",
                tags: ["Booking"]
            }),
        ),
    confirmBooking: oc
        .input(
            z.object({
                id: z.uuid(),
            }),
        )
        .output(createBaseResponse(BookingSchema))
        .meta(
            openapi({
                method: "POST",
                path: "/bookings/{id}/confirm",
                description: "Create booking",
                tags: ["Booking"]
            }),
        ),
    findOne: oc
        .input(
            z.object({
                id: z.uuid(),
            }),
        )
        .output(createBaseResponse(BookingSchema))
        .meta(
            openapi({
                method: "GET",
                path: "/bookings/{id}",
                description: "Find booking by id",
                tags: ["Booking"]
            }),
        ),
    getMyBookings: oc.output(createBaseResponse(z.array(BookingSchema))).meta(
        openapi({
            method: "GET",
            path: "/bookings/booking/me",
            description: "Get user bookings",
            tags: ["Booking"]
        }),
    ),
    cancelBooking: oc
        .input(
            z.object({
                id: z.uuid(),
            }),
        )
        .output(createBaseResponse(z.null()))
        .meta(
            openapi({
                method: "DELETE",
                path: "/bookings/{id}",
                description: "Delete booking",
                tags: ["Booking"]
            }),
        ),
    adminListBookings: oc.output(createBaseResponse(z.array(BookingSchema))).meta(
        openapi({
            method: "GET",
            path: "/bookings/admin/all",
            description: "Admin endpoint to view all bookings",
            tags: ["Booking"]
        }),
    ),
    getEventBookings: oc
        .output(createBaseResponse(z.array(BookingSchema)))
        .input(
            z.object({
                eventId: z.uuid(),
            }),
        )
        .meta(
            openapi({
                method: "GET",
                path: "/bookings/event/{eventId}/bookings",
                description: "Organizer endpoint to view bookings for their events",
                tags: ["Booking"]
            }),
        ),
});

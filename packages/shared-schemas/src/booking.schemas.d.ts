import { z } from "zod";
export declare const CreateBookingSchema: z.ZodObject<{
    eventId: z.ZodString;
    quantity: z.ZodNumber;
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    couponCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    eventId?: string;
    quantity?: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    couponCode?: string;
}, {
    eventId?: string;
    quantity?: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    couponCode?: string;
}>;
export declare const BookingSchema: z.ZodObject<{
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    eventId: z.ZodString;
    quantity: z.ZodNumber;
    couponCode: z.ZodOptional<z.ZodString>;
    id: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    totalAmount: z.ZodNumber;
    finalAmount: z.ZodNumber;
    discount: z.ZodNumber;
    status: z.ZodEnum<["PENDING", "CONFIRMED", "CANCELLED", "FAILED"]>;
    paymentIntentId: z.ZodOptional<z.ZodString>;
    tickets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ticketNumber: z.ZodString;
        qrCode: z.ZodString;
        isValidated: z.ZodBoolean;
        validatedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id?: string;
        ticketNumber?: string;
        qrCode?: string;
        isValidated?: boolean;
        validatedAt?: string;
    }, {
        id?: string;
        ticketNumber?: string;
        qrCode?: string;
        isValidated?: boolean;
        validatedAt?: string;
    }>, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
    firstName?: string;
    lastName?: string;
    eventId?: string;
    quantity?: number;
    couponCode?: string;
    id?: string;
    userId?: string;
    totalAmount?: number;
    finalAmount?: number;
    discount?: number;
    status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED";
    paymentIntentId?: string;
    tickets?: {
        id?: string;
        ticketNumber?: string;
        qrCode?: string;
        isValidated?: boolean;
        validatedAt?: string;
    }[];
    createdAt?: string;
    updatedAt?: string;
}, {
    email?: string;
    firstName?: string;
    lastName?: string;
    eventId?: string;
    quantity?: number;
    couponCode?: string;
    id?: string;
    userId?: string;
    totalAmount?: number;
    finalAmount?: number;
    discount?: number;
    status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "FAILED";
    paymentIntentId?: string;
    tickets?: {
        id?: string;
        ticketNumber?: string;
        qrCode?: string;
        isValidated?: boolean;
        validatedAt?: string;
    }[];
    createdAt?: string;
    updatedAt?: string;
}>;
export type CreateBookingDto = z.infer<typeof CreateBookingSchema>;
export type BookingDto = z.infer<typeof BookingSchema>;

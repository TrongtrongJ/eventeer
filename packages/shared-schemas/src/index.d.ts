import { z } from "zod";
export * from "./event.schemas";
export * from "./booking.schemas";
export * from "./coupon.schemas";
export * from "./auth.schemas";
export * from "./payment.schemas";
export * from "./ticket-validation.schemas";
export * from "./pagination.schemas";
export * from "./user.schemas";
export declare const SeatAvailabilityUpdateSchema: z.ZodObject<{
    eventId: z.ZodString;
    availableSeats: z.ZodNumber;
    capacity: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    eventId?: string;
    availableSeats?: number;
    capacity?: number;
    timestamp?: string;
}, {
    eventId?: string;
    availableSeats?: number;
    capacity?: number;
    timestamp?: string;
}>;
export type SeatAvailabilityUpdate = z.infer<typeof SeatAvailabilityUpdateSchema>;
export declare const ApiResponseSchema: <T extends z.ZodType<any, z.ZodTypeDef, any, core.$ZodTypeInternals<Output, Input>>>(dataSchema: T) => z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    correlationId: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, { [k_1 in keyof z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    correlationId: z.ZodString;
    timestamp: z.ZodString;
}>, undefined extends T["_output"] ? never : "data">]: z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    correlationId: z.ZodString;
    timestamp: z.ZodString;
}>, undefined extends T["_output"] ? never : "data">[k_1]; }, { [k_2 in keyof z.baseObjectInputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    correlationId: z.ZodString;
    timestamp: z.ZodString;
}>]: z.baseObjectInputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
    correlationId: z.ZodString;
    timestamp: z.ZodString;
}>[k_2]; }>;
export type ApiResponse<T> = {
    success: boolean;
    data?: T;
    error?: string;
    correlationId: string;
    timestamp: string;
};

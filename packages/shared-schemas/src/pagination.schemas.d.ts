import { z } from "zod";
export declare const PaginationQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["ASC", "DESC"]>>;
    search: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "ASC" | "DESC";
    search?: string;
}, {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "ASC" | "DESC";
    search?: string;
}>;
export declare const PaginatedResponseSchema: <T extends z.ZodType<any, z.ZodTypeDef, any, core.$ZodTypeInternals<Output, Input>>>(dataSchema: T) => z.ZodObject<{
    data: z.ZodArray<T, "many">;
    meta: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        limit: z.ZodNumber;
        totalPages: z.ZodNumber;
        hasNextPage: z.ZodBoolean;
        hasPreviousPage: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        hasNextPage?: boolean;
        hasPreviousPage?: boolean;
    }, {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        hasNextPage?: boolean;
        hasPreviousPage?: boolean;
    }>;
    links: z.ZodObject<{
        first: z.ZodString;
        previous: z.ZodNullable<z.ZodString>;
        next: z.ZodNullable<z.ZodString>;
        last: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        first?: string;
        previous?: string;
        next?: string;
        last?: string;
    }, {
        first?: string;
        previous?: string;
        next?: string;
        last?: string;
    }>;
}, "strip", z.ZodTypeAny, {
    data?: T["_output"][];
    meta?: {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        hasNextPage?: boolean;
        hasPreviousPage?: boolean;
    };
    links?: {
        first?: string;
        previous?: string;
        next?: string;
        last?: string;
    };
}, {
    data?: T["_input"][];
    meta?: {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        hasNextPage?: boolean;
        hasPreviousPage?: boolean;
    };
    links?: {
        first?: string;
        previous?: string;
        next?: string;
        last?: string;
    };
}>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PaginatedResponse<T> = {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
    links: {
        first: string;
        previous: string | null;
        next: string | null;
        last: string;
    };
};

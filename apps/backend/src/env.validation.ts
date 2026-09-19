import { z } from "zod";
import ms from "ms";

const jwtTimeSchema = z.string().refine(
    val => {
        try {
            return ms(val as ms.StringValue) !== undefined;
        } catch {
            return false;
        }
    },
    { message: "Invalid time format. Use values like '15m', '7d', '24h'." },
);

export const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    HOST: z.url().default("http://localhost"),
    PORT: z.coerce.number().default(4000),
    CORS_ORIGIN: z.url().default("http://localhost:3000"),
    ACCESS_TOKEN_SECRET: z.string().min(1),
    REFRESH_TOKEN_SECRET: z.string().min(1),
    ACCESS_TOKEN_EXPIRY: jwtTimeSchema.default("15m"),
    REFRESH_TOKEN_EXPIRY: jwtTimeSchema.default("7d"),
    COOKIE_SECRET: z.string().min(1),
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.coerce.number().default(5432),
    DB_USERNAME: z.string().default("postgres"),
    DB_PASSWORD: z.string().default("postgres"),
    DB_NAME: z.string().default("monorepo"),
    DB_SSL: z.preprocess(val => val === "true", z.boolean()).default(false),
    CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().default(5),
    CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().default(60000),
    CIRCUIT_BREAKER_RESET_TIMEOUT: z.coerce.number().default(30000),
});

export function validate(config: Record<string, unknown>) {
    const parsed = envSchema.safeParse(config);

    if (!parsed.success) {
        const errors = z.flattenError(parsed.error);
        console.error(JSON.stringify(errors.fieldErrors, null, 2));
        throw new Error("Environment validation failed");
    }

    return {
        ...parsed.data,
        isProd: parsed.data.NODE_ENV === "production",
        isNotProd: parsed.data.NODE_ENV !== "production",
        isDev: parsed.data.NODE_ENV === "development",
        isTest: parsed.data.NODE_ENV === "test",
        accessTokenMs: ms(parsed.data.ACCESS_TOKEN_EXPIRY as ms.StringValue) as number,
        refreshTokenMs: ms(parsed.data.REFRESH_TOKEN_EXPIRY as ms.StringValue) as number,
    };
}

export type EnvConfig = ReturnType<typeof validate>;

import { z } from "zod";
import ms from "ms";

const duration = (fallback: string) =>
    z
        .string()
        .default(fallback)
        .refine(val => typeof ms(val as ms.StringValue) === "number", {
            message: "Invalid duration. Use values like '15m', '7d', '24h'.",
        });

const booleanFlag = (fallback: boolean) =>
    z
        .enum(["true", "false"])
        .default(fallback ? "true" : "false")
        .transform(v => v === "true");

/** `.env` files leave unset values as "": treat that as absent instead of failing z.url(). */
const optionalUrl = () => z.preprocess(v => (v === "" ? undefined : v), z.url().optional());

export const envSchema = z
    .object({
        NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
        PORT: z.coerce.number().default(4000),
        /** Origin of the web app. Used for CORS, redirects, and CSRF origin checks. */
        FRONTEND_URL: z.url().default("http://localhost:3000"),
        /** Number of reverse proxies in front of the API (for correct client IPs). */
        TRUST_PROXY: z.coerce.number().int().min(0).default(0),

        DB_HOST: z.string().default("localhost"),
        DB_PORT: z.coerce.number().default(5432),
        DB_USERNAME: z.string().default("postgres"),
        DB_PASSWORD: z.string().default("postgres"),
        DB_NAME: z.string().default("event_management"),
        DB_SSL: booleanFlag(false),

        REDIS_HOST: z.string().default("localhost"),
        REDIS_PORT: z.coerce.number().default(6379),

        // Opaque-token sessions
        ACCESS_TOKEN_SECRET: z.string().default("fallback-access-key-change-in-production"),
        ACCESS_TOKEN_TTL: duration("15m"),
        REFRESH_TOKEN_SECRET: z.string().default("fallback-refresh-key-change-in-production"),
        REFRESH_TOKEN_TTL: duration("7d"),
        /** Hard cap on a session's total life regardless of refresh activity. */
        SESSION_MAX_LIFETIME: duration("30d"),
        /** Allow self-service ADMIN sign-up. Unset = allowed outside production, refused in production. */
        ALLOW_ADMIN_SIGNUP: z.enum(["true", "false"]).optional(),
        MAX_SESSIONS_PER_USER: z.coerce.number().int().min(1).default(5),

        /** Global + per-route rate limiting. Only disabled for the integration test suite. */
        RATE_LIMIT_ENABLED: booleanFlag(true),
        FEATURE_PAYMENT_ENABLED: booleanFlag(true),
        FEATURE_EMAIL_ENABLED: booleanFlag(false),
        /** How long a PENDING booking holds its seats before being released. */
        BOOKING_HOLD_MINUTES: z.coerce.number().int().min(1).default(15),

        STRIPE_SECRET_KEY: z.string().optional(),
        STRIPE_WEBHOOK_SECRET: z.string().optional(),

        // Direct-to-S3 event image uploads. Unset S3_BUCKET = feature off (the API answers 503).
        // Credentials are NOT configured here: the AWS SDK's default chain supplies them
        // (task role / IRSA in production, AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY locally).
        S3_BUCKET: z.string().optional(),
        S3_REGION: z.string().optional(),
        /** Custom endpoint for S3-compatible stores (MinIO, LocalStack). Leave unset for AWS. */
        S3_ENDPOINT: optionalUrl(),
        /** Endpoint the BROWSER posts to when it differs from S3_ENDPOINT (e.g. http://localhost:9000 vs http://minio:9000). */
        S3_PUBLIC_ENDPOINT: optionalUrl(),
        S3_FORCE_PATH_STYLE: booleanFlag(false),
        /** Where uploaded images are served from: the CloudFront domain, or <endpoint>/<bucket> for MinIO. */
        S3_PUBLIC_BASE_URL: optionalUrl(),
        /** Seconds a presigned upload stays valid. */
        S3_UPLOAD_URL_TTL: z.coerce.number().int().min(30).max(3600).default(300),

        SMTP_HOST: z.string().optional(),
        SMTP_PORT: z.coerce.number().default(587),
        SMTP_USER: z.string().optional(),
        SMTP_PASS: z.string().optional(),
        EMAIL_FROM: z.string().default("noreply@eventeer.local"),

        GOOGLE_CLIENT_ID: z.string().optional(),
        GOOGLE_CLIENT_SECRET: z.string().optional(),
        GOOGLE_REDIRECT_URI: z.string().optional(),
        GITHUB_CLIENT_ID: z.string().optional(),
        GITHUB_CLIENT_SECRET: z.string().optional(),
        GITHUB_REDIRECT_URI: z.string().optional(),
        FACEBOOK_APP_ID: z.string().optional(),
        FACEBOOK_APP_SECRET: z.string().optional(),
        FACEBOOK_REDIRECT_URI: z.string().optional(),

        CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().default(5),
        CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().default(60000),
        CIRCUIT_BREAKER_RESET_TIMEOUT: z.coerce.number().default(30000),
    })
    .check(ctx => {
        // Half-configured uploads would only fail at the first presign: refuse to boot instead.
        const s3 = {
            S3_BUCKET: ctx.value.S3_BUCKET,
            S3_REGION: ctx.value.S3_REGION,
            S3_PUBLIC_BASE_URL: ctx.value.S3_PUBLIC_BASE_URL,
        };
        if (Object.values(s3).some(Boolean)) {
            for (const [key, value] of Object.entries(s3)) {
                if (!value) {
                    ctx.issues.push({
                        code: "custom",
                        path: [key],
                        input: value,
                        message: "Required when any S3_* image upload setting is provided",
                    });
                }
            }
        }

        // Production must never fall back to mock payments or unsent email.
        if (ctx.value.NODE_ENV === "production") {
            const need = (key: keyof typeof ctx.value, why: string) => {
                if (!ctx.value[key]) {
                    ctx.issues.push({
                        code: "custom",
                        path: [key],
                        input: ctx.value[key],
                        message: `Required in production: ${why}`,
                    });
                }
            };

            if (ctx.value.FEATURE_PAYMENT_ENABLED) {
                need("STRIPE_SECRET_KEY", "payments are enabled");
                need("STRIPE_WEBHOOK_SECRET", "confirmation is driven by Stripe webhooks");
            }

            if (ctx.value.FEATURE_EMAIL_ENABLED) need("SMTP_HOST", "email is enabled");

            if (ctx.value.S3_PUBLIC_BASE_URL && !ctx.value.S3_PUBLIC_BASE_URL.startsWith("https://")) {
                ctx.issues.push({
                    code: "custom",
                    path: ["S3_PUBLIC_BASE_URL"],
                    input: ctx.value.S3_PUBLIC_BASE_URL,
                    message: "Must be https in production (mixed content)",
                });
            }

            if (!ctx.value.FRONTEND_URL.startsWith("https://")) {
                ctx.issues.push({
                    code: "custom",
                    path: ["FRONTEND_URL"],
                    input: ctx.value.FRONTEND_URL,
                    message: "Must be https in production (Secure cookies)",
                });
            }
        }
    });

export function validate(config: Record<string, unknown>) {
    const parsed = envSchema.safeParse(config);

    if (!parsed.success) {
        const details = z.flattenError(parsed.error).fieldErrors;
        throw new Error(`Environment validation failed:\n${JSON.stringify(details, null, 2)}`);
    }

    const env = parsed.data;
    return {
        ...env,
        isProd: env.NODE_ENV === "production",
        isDev: env.NODE_ENV === "development",
        isTest: env.NODE_ENV === "test",
        allowAdminSignup: env.ALLOW_ADMIN_SIGNUP ? env.ALLOW_ADMIN_SIGNUP === "true" : env.NODE_ENV !== "production",
        accessTokenMs: ms(env.ACCESS_TOKEN_TTL as ms.StringValue) as number,
        refreshTokenMs: ms(env.REFRESH_TOKEN_TTL as ms.StringValue) as number,
        sessionMaxLifetimeMs: ms(env.SESSION_MAX_LIFETIME as ms.StringValue) as number,
    };
}

export type EnvConfig = ReturnType<typeof validate>;

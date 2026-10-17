import { validate } from "./env.validation";

const prod = {
    NODE_ENV: "production",
    FRONTEND_URL: "https://eventeer.example",
    STRIPE_SECRET_KEY: "sk_live_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
};

describe("env validation", () => {
    it("applies safe defaults in development", () => {
        const env = validate({});
        expect(env.isDev).toBe(true);
        expect(env.accessTokenMs).toBe(15 * 60_000);
        expect(env.refreshTokenMs).toBe(7 * 24 * 3600_000);
    });

    it("refuses to boot production without Stripe (no silent mock payments)", () => {
        expect(() => validate({ ...prod, STRIPE_SECRET_KEY: undefined })).toThrow(/STRIPE_SECRET_KEY/);
        expect(() => validate({ ...prod, STRIPE_WEBHOOK_SECRET: undefined })).toThrow(/STRIPE_WEBHOOK_SECRET/);
    });

    it("requires https in production because cookies are Secure", () => {
        expect(() => validate({ ...prod, FRONTEND_URL: "http://eventeer.example" })).toThrow(/https/);
    });

    it("accepts a complete production config", () => {
        expect(validate(prod).isProd).toBe(true);
    });

    it("allows admin sign-up outside production by default, refuses it in production", () => {
        expect(validate({}).allowAdminSignup).toBe(true);
        expect(validate(prod).allowAdminSignup).toBe(false);
    });

    it("lets ALLOW_ADMIN_SIGNUP override the default either way", () => {
        expect(validate({ ALLOW_ADMIN_SIGNUP: "false" }).allowAdminSignup).toBe(false);
        expect(validate({ ...prod, ALLOW_ADMIN_SIGNUP: "true" }).allowAdminSignup).toBe(true);
    });

    it("rejects malformed durations", () => {
        expect(() => validate({ ACCESS_TOKEN_TTL: "soon" })).toThrow();
    });

    describe("image uploads (S3)", () => {
        const s3 = {
            S3_BUCKET: "example-eventeer-images",
            S3_REGION: "ap-southeast-1",
            S3_PUBLIC_BASE_URL: "https://images.example.com",
        };

        it("is off by default: nothing to configure, nothing required", () => {
            const env = validate({});
            expect(env.S3_BUCKET).toBeUndefined();
            expect(env.S3_UPLOAD_URL_TTL).toBe(300);
        });

        it("accepts a complete setting, and optional MinIO-style endpoints", () => {
            expect(validate(s3).S3_BUCKET).toBe("example-eventeer-images");
            const dev = validate({ ...s3, S3_ENDPOINT: "http://localhost:9000", S3_FORCE_PATH_STYLE: "true" });
            expect(dev.S3_FORCE_PATH_STYLE).toBe(true);
        });

        it("refuses a half-configured setup instead of failing on the first upload", () => {
            expect(() => validate({ S3_BUCKET: "b" })).toThrow(/S3_REGION/);
            expect(() => validate({ S3_BUCKET: "b" })).toThrow(/S3_PUBLIC_BASE_URL/);
            expect(() => validate({ ...s3, S3_BUCKET: undefined })).toThrow(/S3_BUCKET/);
        });

        it("treats blank .env values as unset (copying .env.example must boot)", () => {
            const env = validate({
                S3_BUCKET: "",
                S3_REGION: "",
                S3_ENDPOINT: "",
                S3_PUBLIC_ENDPOINT: "",
                S3_PUBLIC_BASE_URL: "",
            });
            expect(env.S3_ENDPOINT).toBeUndefined();
        });

        it("requires https for the public base URL in production (mixed content)", () => {
            expect(() => validate({ ...prod, ...s3, S3_PUBLIC_BASE_URL: "http://images.example.com" })).toThrow(
                /https/,
            );
            expect(validate({ ...prod, ...s3 }).isProd).toBe(true);
        });

        it("bounds the presigned URL lifetime", () => {
            expect(() => validate({ S3_UPLOAD_URL_TTL: "5" })).toThrow();
            expect(() => validate({ S3_UPLOAD_URL_TTL: "86400" })).toThrow();
        });
    });
});

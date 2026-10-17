import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3ServiceException } from "@aws-sdk/client-s3";
import { ObjectStorageService } from "./object-storage.service";
import { validate } from "../env.validation";

// Placeholder credentials: presigning is a local computation and never calls AWS.
beforeAll(() => {
    process.env.AWS_ACCESS_KEY_ID = "AKIAEXAMPLEPLACEHOLDER";
    process.env.AWS_SECRET_ACCESS_KEY = "example-secret-access-key-placeholder";
});

const BASE = {
    S3_BUCKET: "example-eventeer-images",
    S3_REGION: "ap-southeast-1",
    S3_PUBLIC_BASE_URL: "https://images.example.com/",
};

const build = (env: Record<string, unknown> = BASE) =>
    new ObjectStorageService(new ConfigService(validate(env)) as any);

describe("ObjectStorageService (configured)", () => {
    it("builds public URLs without doubling slashes, and inverts them", () => {
        const s = build();
        expect(s.publicUrl("events/a.webp")).toBe("https://images.example.com/events/a.webp");
        expect(s.keyFromPublicUrl("https://images.example.com/events/a.webp")).toBe("events/a.webp");
    });

    it("does not recognise foreign URLs, look-alike hosts, or the bare base as keys", () => {
        const s = build();
        expect(s.keyFromPublicUrl("https://elsewhere.example.org/events/a.webp")).toBeNull();
        expect(s.keyFromPublicUrl("https://images.example.com.evil.test/events/a.webp")).toBeNull();
        expect(s.keyFromPublicUrl("https://images.example.com/")).toBeNull();
        expect(s.keyFromPublicUrl(undefined)).toBeNull();
    });

    it("signs a POST policy that pins bucket, key, type and size range, and expires", async () => {
        const s = build();
        const before = Date.now();
        const post = await s.createPresignedPost({
            key: "tmp/events/u/f.webp",
            contentType: "image/webp",
            maxBytes: 4096,
        });

        expect(post.url).toContain("example-eventeer-images");
        expect(post.fields.key).toBe("tmp/events/u/f.webp");
        expect(post.fields["Content-Type"]).toBe("image/webp");
        expect(post.fields["Cache-Control"]).toContain("immutable");
        expect(post.fields["X-Amz-Algorithm"]).toBe("AWS4-HMAC-SHA256");
        expect(post.fields["X-Amz-Signature"]).toBeTruthy();
        // Credentials are an example placeholder, never anything real
        expect(post.fields["X-Amz-Credential"]).toContain("AKIAEXAMPLEPLACEHOLDER");
        expect(post.fields["X-Amz-Credential"]).toContain("/ap-southeast-1/s3/");

        const policy = JSON.parse(Buffer.from(post.fields.Policy, "base64").toString());
        expect(policy.conditions).toEqual(
            expect.arrayContaining([
                ["content-length-range", 1, 4096],
                { bucket: "example-eventeer-images" },
                { key: "tmp/events/u/f.webp" },
                { "Content-Type": "image/webp" },
            ]),
        );
        const ttlMs = new Date(policy.expiration).getTime() - before;
        expect(ttlMs).toBeGreaterThan(290_000);
        expect(ttlMs).toBeLessThanOrEqual(301_000);
        expect(post.expiresAt.getTime()).toBeGreaterThan(before);
    });

    it("signs for the browser-facing endpoint when it differs from the internal one (MinIO in Docker)", async () => {
        const s = build({
            ...BASE,
            S3_ENDPOINT: "http://minio:9000",
            S3_PUBLIC_ENDPOINT: "http://localhost:9000",
            S3_FORCE_PATH_STYLE: "true",
        });
        const post = await s.createPresignedPost({ key: "tmp/events/u/f.png", contentType: "image/png", maxBytes: 10 });
        expect(post.url).toBe("http://localhost:9000/example-eventeer-images");
    });

    it("treats a missing object (HEAD 404) as null and rethrows everything else", async () => {
        const s = build();
        const send = vi.spyOn((s as any).client, "send");

        send.mockRejectedValueOnce(
            new S3ServiceException({ name: "NotFound", $fault: "client", $metadata: { httpStatusCode: 404 } }),
        );
        await expect(s.head("tmp/x")).resolves.toBeNull();

        send.mockRejectedValueOnce(
            new S3ServiceException({ name: "AccessDenied", $fault: "client", $metadata: { httpStatusCode: 403 } }),
        );
        await expect(s.head("tmp/x")).rejects.toThrow();

        send.mockResolvedValueOnce({ ContentLength: 42, ContentType: "image/png" } as never);
        await expect(s.head("tmp/x")).resolves.toEqual({ size: 42, contentType: "image/png" });
    });

    it("copies server-side with a URL-encoded CopySource", async () => {
        const s = build();
        const send = vi.spyOn((s as any).client, "send").mockResolvedValue({} as never);
        await s.copy("tmp/events/u/a b.webp", "events/a.webp");
        const cmd = send.mock.calls[0][0] as any;
        expect(cmd.input).toEqual({
            Bucket: "example-eventeer-images",
            Key: "events/a.webp",
            CopySource: "example-eventeer-images/tmp/events/u/a%20b.webp",
        });
    });
});

describe("ObjectStorageService (not configured)", () => {
    it("is simply off, and every S3 operation answers 503", async () => {
        const s = build({});
        expect(s.isConfigured).toBe(false);
        await expect(s.createPresignedPost({ key: "k", contentType: "image/png", maxBytes: 1 })).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
        await expect(s.head("k")).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(s.keyFromPublicUrl("https://images.example.com/events/a.webp")).toBeNull();
    });
});

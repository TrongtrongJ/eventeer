import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { EVENT_IMAGE_MAX_BYTES, EVENT_IMAGE_UPLOAD_KEY_PATTERN } from "@packages/shared-schemas";
import { EventImagesService, sniffImageType } from "./event-images.service";
import type { ObjectStorageService } from "../storage/object-storage.service";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const UUID = "0b6f7c0e-4d1a-4f5e-9a57-0d6a9b3f7e21";
const KEY = `tmp/events/${USER}/${UUID}.webp`;

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = Buffer.from("RIFF\0\0\0\0WEBP", "binary");

function fakeStorage(over: Record<string, unknown> = {}) {
    const storage = {
        isConfigured: true,
        createPresignedPost: vi.fn(async ({ key }: { key: string; contentType?: string; maxBytes?: number }) => ({
            url: "https://s3.test/bucket",
            fields: { key },
            expiresAt: new Date("2030-01-01T00:00:00Z"),
        })),
        head: vi.fn(async () => ({ size: 1234, contentType: "image/webp" })),
        readStart: vi.fn(async () => WEBP),
        copy: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        publicUrl: (key: string) => `https://cdn.test/${key}`,
        keyFromPublicUrl: (url?: string | null) => (url?.startsWith("https://cdn.test/") ? url.slice(17) : null),
    };
    return { ...storage, ...over } as typeof storage;
}

const make = (over = {}) => {
    const storage = fakeStorage(over);
    return { storage, service: new EventImagesService(storage as unknown as ObjectStorageService) };
};

describe("sniffImageType", () => {
    it.each([
        ["jpeg", JPEG, "image/jpeg"],
        ["png", PNG, "image/png"],
        ["webp", WEBP, "image/webp"],
    ])("recognises %s by its magic bytes", (_n, bytes, type) => expect(sniffImageType(bytes)).toBe(type));

    it("rejects HTML/SVG/other payloads and truncated headers", () => {
        expect(sniffImageType(Buffer.from("<html><script>"))).toBeNull();
        expect(sniffImageType(Buffer.from("<svg xmlns="))).toBeNull();
        expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
        expect(sniffImageType(Buffer.alloc(0))).toBeNull();
        expect(sniffImageType(Buffer.from("RIFF\0\0\0\0WAVE", "binary"))).toBeNull();
    });
});

describe("EventImagesService.createUpload", () => {
    it("signs a per-user tmp/ key that satisfies the shared key pattern", async () => {
        const { service, storage } = make();
        const out = await service.createUpload(USER, { contentType: "image/png", size: 5000 });

        expect(out.key).toMatch(EVENT_IMAGE_UPLOAD_KEY_PATTERN);
        expect(out.key.startsWith(`tmp/events/${USER}/`)).toBe(true);
        expect(out.key.endsWith(".png")).toBe(true);
        expect(out).toMatchObject({ url: "https://s3.test/bucket", expiresAt: "2030-01-01T00:00:00.000Z" });
        expect(storage.createPresignedPost).toHaveBeenCalledWith({
            key: out.key,
            contentType: "image/png",
            maxBytes: 5000,
        });
    });

    it("never signs a policy larger than the global cap", async () => {
        const { service, storage } = make();
        await service.createUpload(USER, { contentType: "image/jpeg", size: EVENT_IMAGE_MAX_BYTES * 10 });
        expect(storage.createPresignedPost.mock.calls[0][0].maxBytes).toBe(EVENT_IMAGE_MAX_BYTES);
    });

    it("mints a different key every time", async () => {
        const { service } = make();
        const a = await service.createUpload(USER, { contentType: "image/webp", size: 10 });
        const b = await service.createUpload(USER, { contentType: "image/webp", size: 10 });
        expect(a.key).not.toBe(b.key);
    });

    it("answers 503 when storage is not configured", async () => {
        const { service } = make({ isConfigured: false });
        await expect(service.createUpload(USER, { contentType: "image/webp", size: 10 })).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        );
    });
});

describe("EventImagesService.attach", () => {
    it("copies the verified upload to a permanent events/ key and returns its public URL", async () => {
        const { service, storage } = make();
        const out = await service.attach(USER, KEY);

        expect(storage.copy).toHaveBeenCalledWith(KEY, `events/${UUID}.webp`);
        expect(out).toEqual({ key: `events/${UUID}.webp`, url: `https://cdn.test/events/${UUID}.webp` });
    });

    it("keeps the tmp object so a retry of a failed save can reuse the same key", async () => {
        const { service, storage } = make();
        await service.attach(USER, KEY);
        expect(storage.delete).not.toHaveBeenCalled();
    });

    it("refuses another user's upload without touching S3", async () => {
        const { service, storage } = make();
        await expect(service.attach(OTHER, KEY)).rejects.toBeInstanceOf(BadRequestException);
        expect(storage.head).not.toHaveBeenCalled();
        expect(storage.copy).not.toHaveBeenCalled();
    });

    it("refuses a key outside tmp/ (e.g. an already-published or arbitrary object)", async () => {
        const { service, storage } = make();
        await expect(service.attach(USER, `events/${UUID}.webp`)).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.attach(USER, `../../etc/passwd`)).rejects.toBeInstanceOf(BadRequestException);
        expect(storage.copy).not.toHaveBeenCalled();
    });

    it("explains when the upload is missing or expired", async () => {
        const { service } = make({ head: vi.fn(async () => null) });
        await expect(service.attach(USER, KEY)).rejects.toThrow(/not found or expired/);
    });

    it("rejects an oversized object", async () => {
        const { service, storage } = make({
            head: vi.fn(async () => ({ size: EVENT_IMAGE_MAX_BYTES + 1, contentType: "image/webp" })),
        });
        await expect(service.attach(USER, KEY)).rejects.toThrow(/too large/);
        expect(storage.copy).not.toHaveBeenCalled();
    });

    it("rejects, and deletes, a file whose bytes don't match its declared type (spoofed Content-Type)", async () => {
        const { service, storage } = make({
            readStart: vi.fn(async () => Buffer.from("<html><script>alert(1)</script>")),
        });
        await expect(service.attach(USER, KEY)).rejects.toThrow(/not a valid JPEG, PNG or WebP/);
        expect(storage.delete).toHaveBeenCalledWith(KEY);
        expect(storage.copy).not.toHaveBeenCalled();
    });

    it("rejects a real image whose declared type is different (png bytes labelled webp)", async () => {
        const { service } = make({ readStart: vi.fn(async () => PNG) });
        await expect(service.attach(USER, KEY)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a declared type outside the allow-list (e.g. image/svg+xml)", async () => {
        const { service } = make({ head: vi.fn(async () => ({ size: 10, contentType: "image/svg+xml" })) });
        await expect(service.attach(USER, KEY)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("answers 503 when storage is not configured", async () => {
        const { service } = make({ isConfigured: false });
        await expect(service.attach(USER, KEY)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
});

describe("EventImagesService.discard", () => {
    it("deletes a published events/ object", async () => {
        const { service, storage } = make();
        await service.discard(`https://cdn.test/events/${UUID}.webp`);
        expect(storage.delete).toHaveBeenCalledWith(`events/${UUID}.webp`);
    });

    it.each([
        ["an external URL", "https://images.example.com/a.jpg"],
        ["a tmp/ upload URL", `https://cdn.test/tmp/events/${USER}/${UUID}.webp`],
        ["an empty value", ""],
        ["null", null],
        ["undefined", undefined],
    ])("never deletes %s", async (_label, url) => {
        const { service, storage } = make();
        await service.discard(url as string);
        expect(storage.delete).not.toHaveBeenCalled();
    });

    it("swallows storage failures: a leaked object must not fail the user's request", async () => {
        const { service } = make({ delete: vi.fn(async () => Promise.reject(new Error("AccessDenied"))) });
        await expect(service.discard(`https://cdn.test/events/${UUID}.webp`)).resolves.toBeUndefined();
    });
});

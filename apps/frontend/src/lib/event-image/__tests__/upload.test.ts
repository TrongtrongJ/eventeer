import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENT_IMAGE_SOURCE_MAX_BYTES } from "../constants";
import { postToS3, S3UploadError, validateSourceFile } from "../upload";

describe("validateSourceFile", () => {
    it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s", type => {
        expect(validateSourceFile({ type, size: 1024 })).toBeNull();
    });

    it.each(["image/gif", "image/svg+xml", "image/heic", "application/pdf", "text/html", ""])(
        "rejects %s by type",
        type => expect(validateSourceFile({ type, size: 1024 })).toBe("type"),
    );

    it("rejects files above the source cap, and accepts exactly the cap", () => {
        expect(validateSourceFile({ type: "image/png", size: EVENT_IMAGE_SOURCE_MAX_BYTES + 1 })).toBe("size");
        expect(validateSourceFile({ type: "image/png", size: EVENT_IMAGE_SOURCE_MAX_BYTES })).toBeNull();
    });
});

describe("postToS3", () => {
    const upload = {
        url: "https://s3.example.test/example-bucket",
        // Order matters to S3 only in that `file` is last; the signed fields travel as given.
        fields: { key: "tmp/events/u/f.webp", "Content-Type": "image/webp", Policy: "p", "X-Amz-Signature": "sig" },
    };
    const blob = new Blob(["binary"], { type: "image/webp" });

    afterEach(() => vi.unstubAllGlobals());

    const stubFetch = (res: { status?: number; body?: string }) => {
        const fetchMock = vi.fn(async () => ({
            ok: (res.status ?? 204) < 300,
            status: res.status ?? 204,
            text: async () => res.body ?? "",
        }));
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    };

    it("posts every signed field first and the file LAST, anonymously", async () => {
        const fetchMock = stubFetch({ status: 204 });

        await postToS3(upload, blob);

        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(upload.url);
        expect(init.method).toBe("POST");
        expect(init.credentials).toBe("omit"); // cookies must never reach S3
        const names = [...(init.body as FormData).keys()];
        expect(names).toEqual([...Object.keys(upload.fields), "file"]);
        expect((init.body as FormData).get("key")).toBe("tmp/events/u/f.webp");
        expect((init.body as FormData).get("file")).toBeInstanceOf(Blob);
    });

    it("sets no Content-Type header itself, so the browser adds the multipart boundary", async () => {
        const fetchMock = stubFetch({ status: 204 });
        await postToS3(upload, blob);
        expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toBeUndefined();
    });

    it("surfaces S3's error code from the XML body", async () => {
        stubFetch({
            status: 403,
            body: "<?xml version='1.0'?><Error><Code>AccessDenied</Code><Message>Policy expired</Message></Error>",
        });
        const err = await postToS3(upload, blob).catch(e => e);
        expect(err).toBeInstanceOf(S3UploadError);
        expect(err).toMatchObject({ status: 403, code: "AccessDenied" });
        expect(err.message).toContain("AccessDenied");
    });

    it("still reports the status when the body isn't S3 XML", async () => {
        stubFetch({ status: 502, body: "<html>Bad gateway</html>" });
        const err = await postToS3(upload, blob).catch(e => e);
        expect(err).toMatchObject({ status: 502, code: undefined });
        expect(err.message).toContain("502");
    });

    it("lets network/CORS failures propagate to the caller", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
        await expect(postToS3(upload, blob)).rejects.toThrow("Failed to fetch");
    });

    it("passes the abort signal through", async () => {
        const fetchMock = stubFetch({ status: 204 });
        const controller = new AbortController();
        await postToS3(upload, blob, controller.signal);
        expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBe(controller.signal);
    });
});

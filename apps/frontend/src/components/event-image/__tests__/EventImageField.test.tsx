import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { http, HttpResponse } from "msw";
import { NextIntlClientProvider } from "next-intl";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import en from "../../../../messages/en.json";
import { server } from "@/test-utils/server";
import { apiError, wrapResponse } from "@/test-utils/response-envelope";
import { renderWithQueryClient } from "@/test-utils/query-test-utils";
import { apiUrl } from "@/lib/orpc/config";
import { S3UploadError } from "@/lib/event-image/upload";
import { EventImageField } from "../EventImageField";

const mocks = vi.hoisted(() => ({
    addToast: vi.fn(),
    postToS3: vi.fn(),
    cropImageToBlob: vi.fn(),
}));

vi.mock("@/lib/toast/toast-context", () => ({ useToast: () => ({ addToast: mocks.addToast }) }));
vi.mock("@/lib/event-image/crop-image", () => ({ cropImageToBlob: mocks.cropImageToBlob }));
vi.mock("@/lib/event-image/upload", async importOriginal => ({
    ...(await importOriginal<typeof import("@/lib/event-image/upload")>()),
    postToS3: mocks.postToS3,
}));
// The real cropper needs layout, which jsdom doesn't have: a stub that reports a fixed crop.
vi.mock("react-easy-crop", () => ({
    default: ({ onCropComplete }: { onCropComplete: (a: unknown, p: unknown) => void }) => {
        // Once on mount, like the real cropper after the image loads (not on every render).
        // eslint-disable-next-line react-hooks/exhaustive-deps
        useEffect(() => onCropComplete({}, { x: 10, y: 20, width: 2100, height: 900 }), []);
        return <div data-testid="cropper" />;
    },
}));

const KEY = "tmp/events/11111111-1111-4111-8111-111111111111/0b6f7c0e-4d1a-4f5e-9a57-0d6a9b3f7e21.webp";
const presigned = {
    url: "https://s3.example.test/example-bucket",
    fields: { key: KEY, Policy: "policy", "X-Amz-Signature": "sig" },
    key: KEY,
    expiresAt: "2030-01-01T00:00:00.000Z",
};
const croppedBlob = new Blob(["cropped"], { type: "image/webp" });

function renderField(onChange = vi.fn()) {
    renderWithQueryClient(
        <NextIntlClientProvider locale="en" messages={en}>
            <EventImageField onChange={onChange} />
        </NextIntlClientProvider>,
    );
    return onChange;
}

const pick = (file: File) => fireEvent.change(screen.getByTestId("event-image-input"), { target: { files: [file] } });
const photo = (name = "photo.png", type = "image/png") => new File(["pixels"], name, { type });
const apply = () => fireEvent.click(screen.getByRole("button", { name: en.CreateEvent.imageApply }));

describe("EventImageField", () => {
    let presignRequests: unknown[];

    beforeEach(() => {
        presignRequests = [];
        mocks.cropImageToBlob.mockResolvedValue(croppedBlob);
        mocks.postToS3.mockResolvedValue(undefined);
        server.use(
            http.post(`${apiUrl}/events/image-upload`, async ({ request }) => {
                presignRequests.push(await request.json());
                return HttpResponse.json(wrapResponse(presigned));
            }),
        );
        let n = 0;
        vi.stubGlobal(
            "URL",
            Object.assign(URL, { createObjectURL: vi.fn(() => `blob:mock-${++n}`), revokeObjectURL: vi.fn() }),
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("starts empty, with nothing to remove", () => {
        renderField();
        expect(screen.getByRole("button", { name: en.CreateEvent.imageChoose })).toBeTruthy();
        expect(screen.queryByRole("button", { name: en.CreateEvent.imageRemove })).toBeNull();
        expect(screen.queryByTestId("cropper")).toBeNull();
    });

    it("opens the cropper for a valid image, without uploading anything yet", () => {
        renderField();
        pick(photo());

        expect(screen.getByTestId("cropper")).toBeTruthy();
        expect(presignRequests).toHaveLength(0);
        expect(mocks.postToS3).not.toHaveBeenCalled();
    });

    it("rejects an unsupported type and an oversized file before any work", () => {
        renderField();

        pick(photo("anim.gif", "image/gif"));
        expect(mocks.addToast).toHaveBeenLastCalledWith({ message: en.CreateEvent.imageInvalidType, type: "error" });

        const huge = photo();
        Object.defineProperty(huge, "size", { value: 21 * 1024 * 1024 });
        pick(huge);
        expect(mocks.addToast).toHaveBeenLastCalledWith({ message: en.CreateEvent.imageTooLarge, type: "error" });

        expect(screen.queryByTestId("cropper")).toBeNull();
    });

    it("crops, requests a presigned POST for the cropped blob, uploads to S3, then reports the key", async () => {
        const onChange = renderField();
        pick(photo());
        apply();

        await waitFor(() => expect(onChange).toHaveBeenCalledWith(KEY));

        // The cropper's pixel area is what gets rendered...
        expect(mocks.cropImageToBlob).toHaveBeenCalledWith("blob:mock-1", { x: 10, y: 20, width: 2100, height: 900 });
        // ...and the API is told the real type and size of what will be uploaded.
        expect(presignRequests).toEqual([{ contentType: "image/webp", size: croppedBlob.size }]);
        expect(mocks.postToS3).toHaveBeenCalledWith(
            expect.objectContaining({ url: presigned.url, fields: presigned.fields }),
            croppedBlob,
        );

        // Closed, with the cropped preview and the replace/remove controls shown.
        await waitFor(() => expect(screen.queryByTestId("cropper")).toBeNull());
        expect(screen.getByAltText(en.CreateEvent.imagePreviewAlt).getAttribute("src")).toBe("blob:mock-2");
        expect(screen.getByRole("button", { name: en.CreateEvent.imageReplace })).toBeTruthy();
        expect(mocks.addToast).not.toHaveBeenCalled();
    });

    it("keeps the dialog open and reports nothing when S3 rejects the upload, so the user can retry", async () => {
        mocks.postToS3.mockRejectedValueOnce(new S3UploadError(403, "AccessDenied"));
        const onChange = renderField();
        pick(photo());
        apply();

        await waitFor(() =>
            expect(mocks.addToast).toHaveBeenCalledWith({
                message: expect.stringContaining("AccessDenied"),
                type: "error",
            }),
        );
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByTestId("cropper")).toBeTruthy();

        // Retry succeeds without re-picking or re-cropping.
        apply();
        await waitFor(() => expect(onChange).toHaveBeenCalledWith(KEY));
    });

    it("shows the API's message and never contacts S3 when uploads aren't available", async () => {
        server.use(
            http.post(`${apiUrl}/events/image-upload`, () =>
                HttpResponse.json(apiError("SERVICE_UNAVAILABLE", "Image uploads are not configured"), { status: 503 }),
            ),
        );
        const onChange = renderField();
        pick(photo());
        apply();

        await waitFor(() =>
            expect(mocks.addToast).toHaveBeenCalledWith({
                message: expect.stringContaining("Image uploads are not configured"),
                type: "error",
            }),
        );
        expect(mocks.postToS3).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("cancelling the cropper uploads nothing", () => {
        const onChange = renderField();
        pick(photo());
        fireEvent.click(screen.getByRole("button", { name: en.Common.cancel }));

        expect(screen.queryByTestId("cropper")).toBeNull();
        expect(presignRequests).toHaveLength(0);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("removing the image clears the key and the preview", async () => {
        const onChange = renderField();
        pick(photo());
        apply();
        await waitFor(() => expect(onChange).toHaveBeenCalledWith(KEY));

        fireEvent.click(await screen.findByRole("button", { name: en.CreateEvent.imageRemove }));

        expect(onChange).toHaveBeenLastCalledWith(undefined);
        expect(screen.queryByAltText(en.CreateEvent.imagePreviewAlt)).toBeNull();
        expect(screen.getByRole("button", { name: en.CreateEvent.imageChoose })).toBeTruthy();
    });
});

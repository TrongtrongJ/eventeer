import { test, expect } from "@playwright/test";
import { mockAuthMe, mockEventDetail, loginAsRole } from "./support/mock-routes";
import { mockEvent, wrapResponse } from "../src/mocks/fixtures";

const API_URL = "http://localhost:4000";
const S3_URL = "https://s3.example.test/example-bucket";
const KEY = "tmp/events/11111111-1111-4111-8111-111111111111/0b6f7c0e-4d1a-4f5e-9a57-0d6a9b3f7e21.webp";

// 420x180 solid PNG (21:9). Real pixels matter: the browser decodes and re-encodes it on a real canvas.
const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAaQAAAC0CAIAAABUj89NAAACaUlEQVR4nO3UQQkAIADAQOMY0YjGsoWCO7gAe23MtQG+N54XAFxgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQlmBySYHZBgdkCC2QEJZgckmB2QYHZAgtkBCWYHJJgdkGB2QILZAQkHW2lg0smahwUAAAAASUVORK5CYII=",
    "base64",
);

/**
 * Pick -> crop -> presigned POST to S3 -> create event with the returned key.
 * The API and S3 are mocked; the cropper, canvas encoding and multipart upload are the real browser's.
 */
test.describe("event cover image upload", () => {
    test("crops in the browser, uploads straight to S3, and submits the key with the event", async ({
        page,
        context,
    }) => {
        await mockAuthMe(page);
        await loginAsRole(context, "ORGANIZER");
        await mockEventDetail(page);

        let presignBody: { contentType: string; size: number } | undefined;
        await page.route(`${API_URL}/events/image-upload`, async route => {
            presignBody = route.request().postDataJSON();
            await route.fulfill({
                json: wrapResponse({
                    url: S3_URL,
                    fields: {
                        key: KEY,
                        "Content-Type": presignBody!.contentType,
                        Policy: "policy",
                        "X-Amz-Signature": "sig",
                    },
                    key: KEY,
                    expiresAt: new Date(Date.now() + 300_000).toISOString(),
                }),
            });
        });

        let s3Request: { headers: Record<string, string>; body: Buffer } | undefined;
        await page.route(`${S3_URL}`, async route => {
            s3Request = { headers: route.request().headers(), body: route.request().postDataBuffer()! };
            // What a bucket with the CORS rule from the Terraform config answers.
            await route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
        });

        let createBody: Record<string, unknown> | undefined;
        await page.route(`${API_URL}/events`, async route => {
            if (route.request().method() !== "POST") return route.fallback();
            createBody = route.request().postDataJSON();
            await route.fulfill({ json: wrapResponse(mockEvent) });
        });

        await page.goto("/create");
        await page.getByLabel("Event Title *").fill("Cropped Cover Fest");
        await page.getByLabel("Description *").fill("A long enough description for validation");
        await page.getByLabel("Location *").fill("Bangkok");
        await page.getByLabel("Start Date *").fill("2030-01-10T10:00");
        await page.getByLabel("End Date *").fill("2030-01-10T18:00");

        await page
            .getByTestId("event-image-input")
            .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG });
        await expect(page.getByTestId("crop-area")).toBeVisible();

        // Zoom with the slider, then accept the crop.
        await page.getByLabel("Zoom").fill("2");
        await page.getByRole("button", { name: "Use this image" }).click();

        await expect(page.getByAltText("Selected event cover")).toBeVisible();
        await expect(page.getByTestId("crop-area")).toHaveCount(0);

        // The API signed exactly what the browser produced: a re-encoded WebP/JPEG, not the 420x180 PNG.
        expect(["image/webp", "image/jpeg"]).toContain(presignBody!.contentType);
        expect(s3Request!.headers["content-type"]).toContain("multipart/form-data");
        expect(s3Request!.headers["cookie"]).toBeUndefined(); // credentials never reach S3
        const multipart = s3Request!.body.toString("latin1");
        expect(multipart.indexOf('name="key"')).toBeGreaterThan(-1);
        expect(multipart.indexOf('name="file"')).toBeGreaterThan(multipart.indexOf('name="X-Amz-Signature"')); // file last

        await page.getByRole("button", { name: "Create Event" }).click();
        await expect(page).toHaveURL(new RegExp(`/events/${mockEvent.id}`));

        expect(createBody).toMatchObject({ title: "Cropped Cover Fest", imageUploadKey: KEY });
        expect(createBody).not.toHaveProperty("imageUrl");
    });

    test("an unsupported file is refused before the cropper opens", async ({ page, context }) => {
        await mockAuthMe(page);
        await loginAsRole(context, "ORGANIZER");

        await page.goto("/create");
        await page
            .getByTestId("event-image-input")
            .setInputFiles({ name: "a.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });

        await expect(page.getByText("Please choose a JPEG, PNG or WebP image.")).toBeVisible();
        await expect(page.getByTestId("crop-area")).toHaveCount(0);
    });
});

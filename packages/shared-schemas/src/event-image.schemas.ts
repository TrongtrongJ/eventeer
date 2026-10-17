import { z } from "zod";

/** Formats the browser re-encodes to (see the cropper) and the bucket accepts. */
export const EVENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type EventImageType = (typeof EVENT_IMAGE_TYPES)[number];

export const EVENT_IMAGE_EXTENSIONS: Record<EventImageType, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

/** Enforced by S3 itself through the presigned POST policy, not just by the API. */
export const EVENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Where a not-yet-attached upload lives: `tmp/events/<userId>/<uuid>.<ext>`.
 * A bucket lifecycle rule expires `tmp/`; saving the event copies the object out of it.
 */
export const EVENT_IMAGE_UPLOAD_KEY_PATTERN =
    /^tmp\/events\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const EventImageUploadKeySchema = z.string().regex(EVENT_IMAGE_UPLOAD_KEY_PATTERN, "Invalid image upload key");

export const CreateEventImageUploadSchema = z.object({
    contentType: z.enum(EVENT_IMAGE_TYPES),
    size: z.number().int().positive().max(EVENT_IMAGE_MAX_BYTES),
});

/** Everything the browser needs to POST the file straight to S3. */
export const EventImageUploadSchema = z.object({
    /** S3 endpoint to POST the multipart form to. */
    url: z.url(),
    /** Signed policy fields: send them first, in this order, then the file as the last part. */
    fields: z.record(z.string(), z.string()),
    /** Pass back as `imageUploadKey` when creating or updating the event. */
    key: EventImageUploadKeySchema,
    expiresAt: z.iso.datetime(),
});

export type CreateEventImageUploadDto = z.infer<typeof CreateEventImageUploadSchema>;
export type EventImageUploadDto = z.infer<typeof EventImageUploadSchema>;

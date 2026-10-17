import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
    EVENT_IMAGE_EXTENSIONS,
    EVENT_IMAGE_MAX_BYTES,
    EVENT_IMAGE_TYPES,
    type CreateEventImageUploadDto,
    type EventImageType,
    type EventImageUploadDto,
} from "@packages/shared-schemas";
import { ObjectStorageService } from "../storage/object-storage.service";

const PENDING_PREFIX = "tmp/events";
const FINAL_PREFIX = "events";

/** Real file type from the magic bytes: the declared Content-Type is client-supplied. */
export function sniffImageType(head: Buffer): EventImageType | null {
    if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
    if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return "image/png";
    }
    if (head.length >= 12 && head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") {
        return "image/webp";
    }
    return null;
}

/**
 * Event image lifecycle:
 *   1. createUpload  -> presigned POST into tmp/events/<userId>/<uuid>.<ext> (S3 expires tmp/ by lifecycle rule)
 *   2. browser POSTs the file straight to S3
 *   3. attach        -> on event create/update: verify the upload, copy it to events/<uuid>.<ext>
 *   4. discard       -> when an image is replaced, cleared, or its event deleted
 *
 * Step 3 never deletes the tmp object, so retrying a failed save with the same key just works.
 */
@Injectable()
export class EventImagesService {
    private readonly logger = new Logger(EventImagesService.name);

    constructor(private readonly storage: ObjectStorageService) {}

    async createUpload(userId: string, dto: CreateEventImageUploadDto): Promise<EventImageUploadDto> {
        if (!this.storage.isConfigured) throw new ServiceUnavailableException("Image uploads are not configured");

        const key = `${PENDING_PREFIX}/${userId}/${randomUUID()}.${EVENT_IMAGE_EXTENSIONS[dto.contentType]}`;
        const post = await this.storage.createPresignedPost({
            key,
            contentType: dto.contentType,
            // Bound to the size the client declared (already capped by the schema), so S3 rejects any other body.
            maxBytes: Math.min(dto.size, EVENT_IMAGE_MAX_BYTES),
        });
        return { url: post.url, fields: post.fields, key, expiresAt: post.expiresAt.toISOString() };
    }

    /** Verifies the caller's upload and publishes it. Returns the public URL to store on the event. */
    async attach(userId: string, uploadKey: string): Promise<{ key: string; url: string }> {
        if (!this.storage.isConfigured) throw new ServiceUnavailableException("Image uploads are not configured");
        // Uploads are namespaced per user, so one organizer cannot attach another's file.
        if (!uploadKey.startsWith(`${PENDING_PREFIX}/${userId}/`))
            throw new BadRequestException("Invalid image upload");

        const head = await this.storage.head(uploadKey);
        if (!head) throw new BadRequestException("Image upload not found or expired. Please upload it again.");
        if (head.size > EVENT_IMAGE_MAX_BYTES) throw new BadRequestException("Image is too large");

        const declared = head.contentType as EventImageType | undefined;
        const actual = sniffImageType(await this.storage.readStart(uploadKey, 12));
        if (!declared || !(EVENT_IMAGE_TYPES as readonly string[]).includes(declared) || actual !== declared) {
            await this.discardKey(uploadKey);
            throw new BadRequestException("The uploaded file is not a valid JPEG, PNG or WebP image");
        }

        const key = `${FINAL_PREFIX}/${uploadKey.slice(uploadKey.lastIndexOf("/") + 1)}`;
        await this.storage.copy(uploadKey, key);
        return { key, url: this.storage.publicUrl(key) };
    }

    /** Best-effort removal of a published image. Foreign (external) URLs are ignored. */
    async discard(imageUrl: string | null | undefined): Promise<void> {
        const key = this.storage.keyFromPublicUrl(imageUrl);
        if (key?.startsWith(`${FINAL_PREFIX}/`)) await this.discardKey(key);
    }

    private async discardKey(key: string): Promise<void> {
        try {
            await this.storage.delete(key);
        } catch (err) {
            // An orphaned object costs pennies; failing the user's request over it would not be worth it.
            this.logger.warn({ message: "Failed to delete image object", key, error: String(err) });
        }
    }
}

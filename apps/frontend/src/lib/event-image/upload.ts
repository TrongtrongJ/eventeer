import { EVENT_IMAGE_TYPES, type EventImageUploadDto } from "@packages/shared-schemas";
import { EVENT_IMAGE_SOURCE_MAX_BYTES } from "./constants";

export type SourceFileProblem = "type" | "size";

/** Checks the file the user picked, before any cropping work. */
export function validateSourceFile(file: Pick<File, "type" | "size">): SourceFileProblem | null {
    if (!(EVENT_IMAGE_TYPES as readonly string[]).includes(file.type)) return "type";
    if (file.size > EVENT_IMAGE_SOURCE_MAX_BYTES) return "size";
    return null;
}

export class S3UploadError extends Error {
    constructor(
        readonly status: number,
        /** S3's error code (e.g. EntityTooLarge, AccessDenied, InvalidPolicyDocument), when it sent one. */
        readonly code?: string,
    ) {
        super(code ? `Upload rejected (${code})` : `Upload failed (${status})`);
        this.name = "S3UploadError";
    }
}

/**
 * POSTs the file to the presigned URL. Two details S3 is strict about:
 *  - the signed policy fields come first, and `file` must be the LAST part;
 *  - the request must be anonymous: S3 answers `Access-Control-Allow-Origin: *` which the browser
 *    refuses for credentialed requests, so cookies are never attached (and never should reach S3).
 */
export async function postToS3(
    upload: Pick<EventImageUploadDto, "url" | "fields">,
    file: Blob,
    signal?: AbortSignal,
): Promise<void> {
    const form = new FormData();
    for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
    form.append("file", file);

    const res = await fetch(upload.url, { method: "POST", body: form, credentials: "omit", signal });
    if (res.ok) return;

    const body = await res.text().catch(() => "");
    throw new S3UploadError(res.status, /<Code>([^<]+)<\/Code>/.exec(body)?.[1]);
}

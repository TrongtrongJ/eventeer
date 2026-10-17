import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    CopyObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    S3Client,
    S3ServiceException,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type { EnvConfig } from "../env.validation";

export interface PresignedPost {
    url: string;
    fields: Record<string, string>;
    expiresAt: Date;
}

export interface ObjectHead {
    size: number;
    contentType?: string;
}

const isNotFound = (err: unknown) =>
    err instanceof S3ServiceException &&
    (err.name === "NotFound" || err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404);

/**
 * Thin S3 wrapper (works against AWS, MinIO and LocalStack). Credentials come from the SDK's
 * default provider chain (ECS task role / IRSA in production, AWS_ACCESS_KEY_ID in local
 * development), so none are ever read from or stored in the app config.
 *
 * Unconfigured (no S3_BUCKET) is a legal state: callers check `isConfigured` and answer 503.
 */
@Injectable()
export class ObjectStorageService {
    private readonly logger = new Logger(ObjectStorageService.name);
    private readonly bucket?: string;
    private readonly publicBaseUrl?: string;
    private readonly ttlSeconds: number;
    /** API -> S3 (HEAD / GET / COPY / DELETE). Inside Docker/k8s this may be a private endpoint. */
    private readonly client: S3Client | null;
    /** Only used to sign the browser-facing POST, which needs a browser-reachable endpoint. */
    private readonly presignClient: S3Client | null;

    constructor(config: ConfigService<EnvConfig, true>) {
        this.bucket = config.get("S3_BUCKET", { infer: true }) || undefined;
        const region = config.get("S3_REGION", { infer: true });
        const endpoint = config.get("S3_ENDPOINT", { infer: true });
        const publicEndpoint = config.get("S3_PUBLIC_ENDPOINT", { infer: true }) ?? endpoint;
        const forcePathStyle = config.get("S3_FORCE_PATH_STYLE", { infer: true });
        this.ttlSeconds = config.get("S3_UPLOAD_URL_TTL", { infer: true });
        this.publicBaseUrl = config.get("S3_PUBLIC_BASE_URL", { infer: true })?.replace(/\/+$/, "");

        if (!this.bucket || !region) {
            this.client = this.presignClient = null;
            this.logger.warn("S3 is not configured: image uploads are disabled");
            return;
        }
        const make = (url?: string) => new S3Client({ region, endpoint: url, forcePathStyle });
        this.client = make(endpoint);
        this.presignClient = publicEndpoint === endpoint ? this.client : make(publicEndpoint);
    }

    get isConfigured(): boolean {
        return this.client !== null && !!this.publicBaseUrl;
    }

    /**
     * Presigned POST rather than PUT: a POST policy lets S3 itself reject any body outside
     * [1, maxBytes] or with a different Content-Type, which a presigned PUT cannot do.
     */
    async createPresignedPost(params: { key: string; contentType: string; maxBytes: number }): Promise<PresignedPost> {
        const { key, contentType, maxBytes } = params;
        const { url, fields } = await createPresignedPost(this.requirePresignClient(), {
            Bucket: this.bucket!,
            Key: key,
            Conditions: [["content-length-range", 1, maxBytes]],
            // Each field below also becomes an exact-match condition in the signed policy.
            Fields: {
                "Content-Type": contentType,
                // Keys contain a uuid and are never overwritten, so the object is safe to cache forever.
                "Cache-Control": "public, max-age=31536000, immutable",
            },
            Expires: this.ttlSeconds,
        });
        return { url, fields, expiresAt: new Date(Date.now() + this.ttlSeconds * 1000) };
    }

    /** `null` when the object does not exist. */
    async head(key: string): Promise<ObjectHead | null> {
        try {
            const out = await this.requireClient().send(new HeadObjectCommand({ Bucket: this.bucket!, Key: key }));
            return { size: out.ContentLength ?? 0, contentType: out.ContentType };
        } catch (err) {
            if (isNotFound(err)) return null;
            throw err;
        }
    }

    /** First `length` bytes of the object (used to sniff the real file type). */
    async readStart(key: string, length: number): Promise<Buffer> {
        const out = await this.requireClient().send(
            new GetObjectCommand({ Bucket: this.bucket!, Key: key, Range: `bytes=0-${length - 1}` }),
        );
        return Buffer.from(await out.Body!.transformToByteArray());
    }

    /** Server-side copy: the bytes never pass through the API. Keeps the source's metadata. */
    async copy(fromKey: string, toKey: string): Promise<void> {
        await this.requireClient().send(
            new CopyObjectCommand({
                Bucket: this.bucket!,
                Key: toKey,
                // Keys are validated uuid paths, but CopySource must be URL-encoded regardless.
                CopySource: `${this.bucket}/${fromKey.split("/").map(encodeURIComponent).join("/")}`,
            }),
        );
    }

    async delete(key: string): Promise<void> {
        await this.requireClient().send(new DeleteObjectCommand({ Bucket: this.bucket!, Key: key }));
    }

    publicUrl(key: string): string {
        return `${this.publicBaseUrl}/${key}`;
    }

    /** Inverse of `publicUrl`: `null` for anything that is not one of our objects. */
    keyFromPublicUrl(url: string | null | undefined): string | null {
        if (!url || !this.publicBaseUrl || !url.startsWith(`${this.publicBaseUrl}/`)) return null;
        return url.slice(this.publicBaseUrl.length + 1) || null;
    }

    private requireClient(): S3Client {
        if (!this.client || !this.isConfigured)
            throw new ServiceUnavailableException("Image uploads are not configured");
        return this.client;
    }

    private requirePresignClient(): S3Client {
        this.requireClient();
        return this.presignClient!;
    }
}

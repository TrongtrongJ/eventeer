import request from "supertest";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { ObjectStorageService } from "../../src/storage/object-storage.service";
import { bootApp, credentials, future } from "./helpers";

const WEBP = Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBP", "binary"), Buffer.alloc(32)]);
const HTML = Buffer.from("<html><script>alert(1)</script></html>");

/**
 * The real service signs real presigned POSTs (a pure local computation). Only the calls that would
 * reach S3 (HEAD/GET/COPY/DELETE) are replaced by an in-memory bucket, so the suite needs no AWS.
 */
class InMemoryBucket {
    objects = new Map<string, { body: Buffer; contentType: string }>();
    /** Plays the browser's step: what S3 would hold after a successful POST. */
    upload(key: string, body: Buffer, contentType: string) {
        this.objects.set(key, { body, contentType });
    }
    install(storage: ObjectStorageService) {
        Object.assign(storage, {
            head: async (key: string) => {
                const o = this.objects.get(key);
                return o ? { size: o.body.length, contentType: o.contentType } : null;
            },
            readStart: async (key: string, length: number) => this.objects.get(key)!.body.subarray(0, length),
            copy: async (from: string, to: string) => {
                this.objects.set(to, this.objects.get(from)!);
            },
            delete: async (key: string) => void this.objects.delete(key),
        });
        return storage;
    }
}

describe("Event image uploads (E2E)", () => {
    let app: NestExpressApplication;
    let db: DataSource;
    const bucket = new InMemoryBucket();
    let org: ReturnType<typeof request.agent>;
    let otherOrg: ReturnType<typeof request.agent>;
    let customer: ReturnType<typeof request.agent>;

    const signUp = async (email: string, role?: "ORGANIZER") => {
        let agent = request.agent(app.getHttpServer());
        await agent.post("/auth/register").send(credentials(email)).expect(200);
        if (role) {
            await db.query(`UPDATE users SET role = $1 WHERE email = $2`, [role, email]);
            // The role is cached for a short while: log in again to pick it up.
            agent = request.agent(app.getHttpServer());
            await agent.post("/auth/login").send({ email, password: "Secret123" }).expect(200);
        }
        return agent;
    };

    const presign = (
        agent: typeof org,
        body: Record<string, unknown> = { contentType: "image/webp", size: WEBP.length },
    ) => agent.post("/events/image-upload").send(body);

    /** Presign + "upload": returns the key an organizer would send back with the event. */
    const uploadedKey = async (agent: typeof org, file = WEBP, declaredType = "image/webp") => {
        const res = await presign(agent, { contentType: declaredType, size: file.length }).expect(200);
        const key = res.body.data.key as string;
        bucket.upload(key, file, declaredType);
        return key;
    };

    const eventBody = (over: Record<string, unknown> = {}) => ({
        title: "Image Fest",
        description: "A sufficiently long description",
        location: "Bangkok",
        startDate: future(30),
        endDate: future(31),
        capacity: 10,
        ticketPrice: 100,
        currency: "THB",
        ...over,
    });

    beforeAll(async () => {
        ({ app, dataSource: db } = await bootApp(b =>
            b.overrideProvider(ObjectStorageService).useFactory({
                inject: [ConfigService],
                factory: (config: ConfigService) => bucket.install(new ObjectStorageService(config as never)),
            }),
        ));
        org = await signUp("img-org@test.com", "ORGANIZER");
        otherOrg = await signUp("img-other@test.com", "ORGANIZER");
        customer = await signUp("img-customer@test.com");
    });
    afterAll(() => app.close());

    describe("POST /events/image-upload", () => {
        it("requires authentication and the organizer/admin role", async () => {
            await request(app.getHttpServer())
                .post("/events/image-upload")
                .send({ contentType: "image/webp", size: 10 })
                .expect(401);
            await presign(customer).expect(403);
        });

        it("returns a presigned POST scoped to the caller's tmp/ folder", async () => {
            const res = await presign(org).expect(200);
            const { url, fields, key, expiresAt } = res.body.data;

            expect(url).toContain("example-eventeer-images");
            expect(key).toMatch(/^tmp\/events\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/);
            expect(fields.key).toBe(key);
            expect(fields["Content-Type"]).toBe("image/webp");
            expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

            const policy = JSON.parse(Buffer.from(fields.Policy, "base64").toString());
            expect(policy.conditions).toEqual(
                expect.arrayContaining([
                    ["content-length-range", 1, WEBP.length],
                    { key },
                    { "Content-Type": "image/webp" },
                ]),
            );
        });

        it.each([
            ["a type outside the allow-list", { contentType: "image/svg+xml", size: 100 }],
            ["a type that isn't an image", { contentType: "text/html", size: 100 }],
            ["a file over 5 MB", { contentType: "image/png", size: 6 * 1024 * 1024 }],
            ["an empty file", { contentType: "image/png", size: 0 }],
        ])("rejects %s", async (_label, body) => {
            await presign(org, body).expect(400);
        });
    });

    describe("attaching an upload to an event", () => {
        it("publishes the image and serves it back as the event's imageUrl", async () => {
            const key = await uploadedKey(org);

            const created = await org
                .post("/events")
                .send(eventBody({ imageUploadKey: key }))
                .expect(200);
            const { id, imageUrl } = created.body.data;

            expect(imageUrl).toMatch(/^https:\/\/images\.example\.com\/events\/[0-9a-f-]{36}\.webp$/);
            expect(created.body.data).not.toHaveProperty("imageUploadKey");
            expect(bucket.objects.has(imageUrl.replace("https://images.example.com/", ""))).toBe(true);

            const fetched = await request(app.getHttpServer()).get(`/events/${id}`).expect(200);
            expect(fetched.body.data.imageUrl).toBe(imageUrl);
        });

        it("accepts a retry with the same key after the first attempt (tmp object is kept)", async () => {
            const key = await uploadedKey(org);
            const a = await org
                .post("/events")
                .send(eventBody({ imageUploadKey: key }))
                .expect(200);
            const b = await org
                .post("/events")
                .send(eventBody({ imageUploadKey: key }))
                .expect(200);
            expect(b.body.data.imageUrl).toBe(a.body.data.imageUrl);
        });

        it("refuses another organizer's upload", async () => {
            const key = await uploadedKey(org);
            await otherOrg
                .post("/events")
                .send(eventBody({ imageUploadKey: key }))
                .expect(400);
        });

        it("refuses a key that was never uploaded to", async () => {
            const res = await presign(org).expect(200);
            const created = await org.post("/events").send(eventBody({ imageUploadKey: res.body.data.key }));
            expect(created.status).toBe(400);
            expect(created.body.message ?? created.body.error?.message ?? JSON.stringify(created.body)).toMatch(
                /not found or expired/,
            );
        });

        it("refuses a non-image uploaded under an image Content-Type, and removes it", async () => {
            const key = await uploadedKey(org, HTML, "image/png");
            await org
                .post("/events")
                .send(eventBody({ imageUploadKey: key }))
                .expect(400);
            expect(bucket.objects.has(key)).toBe(false);
        });

        it("refuses malformed or path-traversing keys at validation", async () => {
            for (const imageUploadKey of ["events/x.webp", "../../etc/passwd", "tmp/events/a/b.webp"]) {
                await org.post("/events").send(eventBody({ imageUploadKey })).expect(400);
            }
        });

        it("refuses an event naming both an external URL and an upload", async () => {
            const key = await uploadedKey(org);
            await org
                .post("/events")
                .send(eventBody({ imageUploadKey: key, imageUrl: "https://example.com/a.jpg" }))
                .expect(400);
        });

        it("still accepts a plain external imageUrl", async () => {
            const res = await org
                .post("/events")
                .send(eventBody({ imageUrl: "https://example.com/a.jpg" }))
                .expect(200);
            expect(res.body.data.imageUrl).toBe("https://example.com/a.jpg");
        });
    });

    describe("replacing and removing images", () => {
        const objectKeyOf = (url: string) => url.replace("https://images.example.com/", "");

        it("replaces the image on update and deletes the old object", async () => {
            const first = await org
                .post("/events")
                .send(eventBody({ imageUploadKey: await uploadedKey(org) }))
                .expect(200);
            const { id, imageUrl: oldUrl } = first.body.data;

            const updated = await org
                .put(`/events/${id}`)
                .send({ imageUploadKey: await uploadedKey(org) })
                .expect(200);

            expect(updated.body.data.imageUrl).not.toBe(oldUrl);
            expect(bucket.objects.has(objectKeyOf(updated.body.data.imageUrl))).toBe(true);
            expect(bucket.objects.has(objectKeyOf(oldUrl))).toBe(false);
        });

        it("deletes the object when the image is cleared", async () => {
            const first = await org
                .post("/events")
                .send(eventBody({ imageUploadKey: await uploadedKey(org) }))
                .expect(200);
            const { id, imageUrl } = first.body.data;

            await org.put(`/events/${id}`).send({ imageUrl: "" }).expect(200);
            expect(bucket.objects.has(objectKeyOf(imageUrl))).toBe(false);
        });

        it("leaves the image untouched when other fields are edited", async () => {
            const first = await org
                .post("/events")
                .send(eventBody({ imageUploadKey: await uploadedKey(org) }))
                .expect(200);
            const { id, imageUrl } = first.body.data;

            const updated = await org.put(`/events/${id}`).send({ title: "Renamed Fest" }).expect(200);
            expect(updated.body.data.imageUrl).toBe(imageUrl);
            expect(bucket.objects.has(objectKeyOf(imageUrl))).toBe(true);
        });

        it("deletes the object together with the event", async () => {
            const first = await org
                .post("/events")
                .send(eventBody({ imageUploadKey: await uploadedKey(org) }))
                .expect(200);
            const { id, imageUrl } = first.body.data;

            await org.delete(`/events/${id}`).expect(200);
            expect(bucket.objects.has(objectKeyOf(imageUrl))).toBe(false);
        });

        it("never touches an external image URL's host when the event is deleted", async () => {
            const res = await org
                .post("/events")
                .send(eventBody({ imageUrl: "https://example.com/a.jpg" }))
                .expect(200);
            await org.delete(`/events/${res.body.data.id}`).expect(200);
            // nothing to assert on the bucket: the point is that it neither throws nor 500s
        });
    });
});

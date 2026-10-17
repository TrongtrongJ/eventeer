import { BadRequestException, ConflictException, HttpException } from "@nestjs/common";
import { EventsService } from "./events.service";
import type { Event } from "../entities/event.entity";
import type { EventImagesService } from "./event-images.service";

const iso = (days: number) => new Date(Date.now() + days * 86_400_000);

const makeEvent = (over: Partial<Event> = {}): Event =>
    ({
        id: "evt-1",
        title: "Rock Night",
        description: "d",
        location: "Bangkok",
        startDate: iso(10),
        endDate: iso(11),
        capacity: 100,
        availableSeats: 60, // 40 sold
        ticketPrice: 500,
        currency: "THB",
        organizerId: "org-1",
        organizer: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...over,
    }) as Event;

/** Fluent TypeORM query-builder stand-in that records the clauses it was given. */
function fakeQueryBuilder(raw: unknown[] = []) {
    const calls: { set?: Record<string, () => string>; where?: string; params?: Record<string, unknown> } = {};
    const qb: any = {
        update: () => qb,
        set: (v: Record<string, () => string>) => ((calls.set = v), qb),
        where: (clause: string, params: Record<string, unknown>) => (
            (calls.where = clause),
            (calls.params = params),
            qb
        ),
        returning: () => qb,
        execute: async () => ({ raw }),
    };
    return { qb, calls };
}

describe("EventsService", () => {
    let repo: { save: any; create: any; findOne: any; delete: any; createQueryBuilder?: any };
    let gateway: { emitSeatUpdate: any };
    let images: { attach: ReturnType<typeof vi.fn>; discard: ReturnType<typeof vi.fn> };
    let service: EventsService;

    beforeEach(() => {
        repo = {
            // like a real save: assigns an id and the audit timestamps
            save: vi.fn(async e => ({ id: "evt-new", createdAt: new Date(), updatedAt: new Date(), ...e })),
            create: vi.fn(e => e),
            findOne: vi.fn(),
            delete: vi.fn(),
        };
        gateway = { emitSeatUpdate: vi.fn() };
        images = {
            attach: vi.fn(async (_user: string, key: string) => ({
                key: "events/new.webp",
                url: `https://cdn.test/events/${key.split("/").pop()}`,
            })),
            discard: vi.fn(async () => undefined),
        };
        service = new EventsService(repo as any, gateway as any, images as unknown as EventImagesService);
    });

    describe("create", () => {
        const dto = {
            title: "T",
            description: "D",
            location: "L",
            capacity: 50,
            ticketPrice: 10,
            currency: "THB",
            startDate: iso(5).toISOString(),
            endDate: iso(6).toISOString(),
        } as any;

        it("starts with every seat available and records the organizer", async () => {
            const created = await service.create(dto, "org-9", "cid");
            expect(repo.create).toHaveBeenCalledWith(
                expect.objectContaining({ organizerId: "org-9", availableSeats: 50, capacity: 50 }),
            );
            expect(created.availableSeats).toBe(50);
        });

        it("rejects an end date that is not after the start date", async () => {
            await expect(service.create({ ...dto, endDate: dto.startDate }, "org-9", "cid")).rejects.toBeInstanceOf(
                BadRequestException,
            );
            expect(repo.save).not.toHaveBeenCalled();
        });
    });

    describe("update", () => {
        it("changing capacity preserves the seats already sold (100 -> 150 with 40 sold = 110 free)", async () => {
            const event = makeEvent();
            repo.findOne.mockResolvedValue(event);

            const updated = await service.update("evt-1", { capacity: 150 } as any, "cid", "org-1");

            expect(updated.capacity).toBe(150);
            expect(updated.availableSeats).toBe(110);
            expect(gateway.emitSeatUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ eventId: "evt-1", availableSeats: 110, capacity: 150 }),
            );
        });

        it("refuses to lower capacity below the seats already sold", async () => {
            repo.findOne.mockResolvedValue(makeEvent()); // 40 sold
            await expect(service.update("evt-1", { capacity: 39 } as any, "cid", "org-1")).rejects.toThrow(
                /40 seats already booked/,
            );
            expect(repo.save).not.toHaveBeenCalled();
        });

        it("allows lowering capacity exactly to the sold count", async () => {
            repo.findOne.mockResolvedValue(makeEvent());
            const updated = await service.update("evt-1", { capacity: 40 } as any, "cid", "org-1");
            expect(updated.availableSeats).toBe(0);
        });

        it("validates the resulting date window against the stored dates too", async () => {
            repo.findOne.mockResolvedValue(makeEvent());
            // only endDate supplied, earlier than the stored startDate
            await expect(
                service.update("evt-1", { endDate: iso(1).toISOString() } as any, "cid", "org-1"),
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it("404s for an unknown event", async () => {
            repo.findOne.mockResolvedValue(null);
            await expect(service.update("nope", {} as any, "cid", "org-1")).rejects.toMatchObject({ status: 404 });
        });
    });

    describe("delete", () => {
        it("turns the FK violation from existing bookings into a 409 instead of a 500", async () => {
            repo.delete.mockRejectedValue({ driverError: { code: "23503" } });
            await expect(service.delete("evt-1", "cid")).rejects.toBeInstanceOf(ConflictException);
        });

        it("404s when nothing was deleted", async () => {
            repo.delete.mockResolvedValue({ affected: 0 });
            await expect(service.delete("evt-1", "cid")).rejects.toMatchObject({ status: 404 });
        });

        it("rethrows unexpected database errors untouched", async () => {
            const boom = new Error("connection lost");
            repo.delete.mockRejectedValue(boom);
            await expect(service.delete("evt-1", "cid")).rejects.toBe(boom);
        });
    });

    describe("reserveSeats (the anti-oversell primitive)", () => {
        const reserved = {
            id: "evt-1",
            title: "T",
            ticketPrice: "500.00",
            currency: "THB",
            capacity: 100,
            availableSeats: 57,
        };

        it("is ONE conditional UPDATE guarded on availability and on the event not having ended", async () => {
            const { qb, calls } = fakeQueryBuilder([reserved]);
            const manager = { createQueryBuilder: () => qb } as any;

            const row = await service.reserveSeats(manager, "evt-1", 3);

            expect(row).toEqual(reserved);
            expect(calls.where).toContain('"availableSeats" >= :quantity');
            expect(calls.where).toContain('"endDate" > now()');
            expect(calls.params).toEqual({ eventId: "evt-1", quantity: 3 });
            expect(calls.set!.availableSeats()).toBe('"availableSeats" - :quantity');
        });

        it.each([
            ["unknown event", null, 404, /not found/i],
            ["ended event", makeEvent({ endDate: iso(-1) }), 400, /ended/i],
            ["sold-out event", makeEvent({ availableSeats: 0 }), 400, /sold out/i],
            ["too few seats left", makeEvent({ availableSeats: 2 }), 400, /Only 2 seat/],
        ])("explains why a reservation failed: %s", async (_label, event, status, message) => {
            const { qb } = fakeQueryBuilder([]); // UPDATE matched no row
            const manager = { createQueryBuilder: () => qb, findOne: vi.fn().mockResolvedValue(event) } as any;

            const err = await service.reserveSeats(manager, "evt-1", 5).catch(e => e);

            expect(err).toBeInstanceOf(HttpException);
            expect(err.getStatus()).toBe(status);
            expect(err.message).toMatch(message);
        });
    });

    describe("releaseSeats", () => {
        it("caps availability at capacity so a double release can never mint seats", async () => {
            const { qb, calls } = fakeQueryBuilder();
            await service.releaseSeats({ createQueryBuilder: () => qb } as any, "evt-1", 2);
            expect(calls.set!.availableSeats()).toBe('LEAST("capacity", "availableSeats" + :quantity)');
            expect(calls.params).toEqual({ eventId: "evt-1", quantity: 2 });
        });
    });

    describe("findAllPaginated", () => {
        it("falls back to a safe sort column instead of interpolating user input", async () => {
            const qb: any = {
                leftJoinAndSelect: () => qb,
                andWhere: () => qb,
                skip: () => qb,
                take: () => qb,
                orderBy: vi.fn(() => qb),
                getManyAndCount: async () => [[], 0],
            };
            repo.createQueryBuilder = () => qb;

            await service.findAllPaginated({ sortBy: "title; DROP TABLE events;--" }, {});

            expect(qb.orderBy).toHaveBeenCalledWith("event.startDate", "DESC");
        });
    });

    describe("event images", () => {
        const base = {
            title: "T",
            description: "D",
            location: "L",
            capacity: 50,
            ticketPrice: 10,
            currency: "THB",
            startDate: iso(5).toISOString(),
            endDate: iso(6).toISOString(),
        } as any;
        const KEY = "tmp/events/org-9/0b6f7c0e-4d1a-4f5e-9a57-0d6a9b3f7e21.webp";
        const PUBLIC = "https://cdn.test/events/0b6f7c0e-4d1a-4f5e-9a57-0d6a9b3f7e21.webp";

        it("create: attaches the organizer's upload and stores the published URL, not the upload key", async () => {
            const created = await service.create({ ...base, imageUploadKey: KEY }, "org-9", "cid");

            expect(images.attach).toHaveBeenCalledWith("org-9", KEY);
            const row = repo.create.mock.calls[0][0];
            expect(row.imageUrl).toBe(PUBLIC);
            expect(row).not.toHaveProperty("imageUploadKey");
            expect(created.imageUrl).toBe(PUBLIC);
        });

        it("create: an external imageUrl is stored as-is and nothing is attached", async () => {
            await service.create({ ...base, imageUrl: "https://example.com/a.jpg" }, "org-9", "cid");
            expect(images.attach).not.toHaveBeenCalled();
            expect(repo.create.mock.calls[0][0].imageUrl).toBe("https://example.com/a.jpg");
        });

        it("create: refuses an event that names two image sources, before touching storage", async () => {
            await expect(
                service.create({ ...base, imageUrl: "https://example.com/a.jpg", imageUploadKey: KEY }, "org-9", "cid"),
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(images.attach).not.toHaveBeenCalled();
            expect(repo.save).not.toHaveBeenCalled();
        });

        it("create: does not leave a published image behind when the insert fails", async () => {
            repo.save.mockRejectedValue(new Error("db down"));
            await expect(service.create({ ...base, imageUploadKey: KEY }, "org-9", "cid")).rejects.toThrow("db down");
            expect(images.discard).toHaveBeenCalledWith(PUBLIC);
        });

        it("update: attaches as the ACTING user (an admin editing someone else's event uploads as themselves)", async () => {
            repo.findOne.mockResolvedValue(makeEvent());
            await service.update("evt-1", { imageUploadKey: KEY } as any, "cid", "admin-1");
            expect(images.attach).toHaveBeenCalledWith("admin-1", KEY);
        });

        it("update: removes the previous image once the new one is saved", async () => {
            repo.findOne.mockResolvedValue(makeEvent({ imageUrl: "https://cdn.test/events/old.webp" }));
            await service.update("evt-1", { imageUploadKey: KEY } as any, "cid", "org-1");
            expect(images.discard).toHaveBeenCalledWith("https://cdn.test/events/old.webp");
        });

        it('update: clearing the image ("") discards the old object', async () => {
            repo.findOne.mockResolvedValue(makeEvent({ imageUrl: "https://cdn.test/events/old.webp" }));
            const updated = await service.update("evt-1", { imageUrl: "" } as any, "cid", "org-1");
            expect(updated.imageUrl).toBe("");
            expect(images.discard).toHaveBeenCalledWith("https://cdn.test/events/old.webp");
        });

        it("update: leaves the image alone when the request doesn't mention it", async () => {
            repo.findOne.mockResolvedValue(makeEvent({ imageUrl: "https://cdn.test/events/keep.webp" }));
            await service.update("evt-1", { title: "Renamed" } as any, "cid", "org-1");
            expect(images.attach).not.toHaveBeenCalled();
            expect(images.discard).not.toHaveBeenCalled();
        });

        it("update: keeps the previous image when the save fails, and discards only the new one", async () => {
            repo.findOne.mockResolvedValue(makeEvent({ imageUrl: "https://cdn.test/events/old.webp" }));
            repo.save.mockRejectedValue(new Error("db down"));
            await expect(service.update("evt-1", { imageUploadKey: KEY } as any, "cid", "org-1")).rejects.toThrow(
                "db down",
            );
            expect(images.discard).toHaveBeenCalledTimes(1);
            expect(images.discard).toHaveBeenCalledWith(PUBLIC);
        });

        it("delete: discards the image only after the row is gone", async () => {
            repo.findOne.mockResolvedValue({ id: "evt-1", imageUrl: PUBLIC });
            repo.delete.mockResolvedValue({ affected: 1 });
            await service.delete("evt-1", "cid");
            expect(images.discard).toHaveBeenCalledWith(PUBLIC);
        });

        it("delete: keeps the image when the delete is refused (event has bookings)", async () => {
            repo.findOne.mockResolvedValue({ id: "evt-1", imageUrl: PUBLIC });
            repo.delete.mockRejectedValue({ driverError: { code: "23503" } });
            await expect(service.delete("evt-1", "cid")).rejects.toBeInstanceOf(ConflictException);
            expect(images.discard).not.toHaveBeenCalled();
        });
    });
});

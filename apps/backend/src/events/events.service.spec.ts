import { BadRequestException, ConflictException, HttpException } from "@nestjs/common";
import { EventsService } from "./events.service";
import type { Event } from "../entities/event.entity";

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
    let repo: {
        save: any;
        create: any;
        findOne: any;
        delete: any;
        createQueryBuilder?: any;
        manager?: any;
        findOneOrFail?: any;
    };
    let gateway: { emitSeatUpdate: any };
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
        service = new EventsService(repo as any, gateway as any);
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

    describe("update (atomic against concurrent bookings)", () => {
        let tx: { findOne: any; save: any; exists: any };

        beforeEach(() => {
            tx = { findOne: vi.fn(), save: vi.fn(async e => e), exists: vi.fn().mockResolvedValue(false) };
            repo.manager = { transaction: vi.fn(async (fn: any) => fn(tx)) };
            // the post-commit read: whatever the transaction saved
            repo.findOneOrFail = vi.fn(async () => tx.save.mock.calls.at(-1)?.[0] ?? makeEvent());
        });

        it("reads the event under a pessimistic write lock, without joins", async () => {
            tx.findOne.mockResolvedValue(makeEvent());
            await service.update("evt-1", { title: "New" } as any, "cid");
            const [, options] = tx.findOne.mock.calls[0];
            expect(options.lock).toEqual({ mode: "pessimistic_write" });
            expect(options.relations).toBeUndefined(); // FOR UPDATE cannot lock an outer join
        });

        it("changing capacity preserves the seats already sold (100 -> 150 with 40 sold = 110 free)", async () => {
            tx.findOne.mockResolvedValue(makeEvent());
            const updated = await service.update("evt-1", { capacity: 150 } as any, "cid");
            expect(updated.capacity).toBe(150);
            expect(updated.availableSeats).toBe(110);
            expect(gateway.emitSeatUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ eventId: "evt-1", availableSeats: 110, capacity: 150 }),
            );
        });

        it("uses the sold count of the LOCKED row, so a booking that landed first is respected", async () => {
            // the row the lock returns already shows 90 sold (a booking committed since the caller last looked)
            tx.findOne.mockResolvedValue(makeEvent({ availableSeats: 10 }));
            await expect(service.update("evt-1", { capacity: 95 } as any, "cid")).resolves.toMatchObject({
                capacity: 95,
                availableSeats: 5,
            });
            tx.findOne.mockResolvedValue(makeEvent({ availableSeats: 2 })); // 98 sold
            await expect(service.update("evt-1", { capacity: 95 } as any, "cid")).rejects.toThrow(
                /98 seats already booked/,
            );
        });

        it("refuses to lower capacity below the seats already sold, and writes nothing", async () => {
            tx.findOne.mockResolvedValue(makeEvent()); // 40 sold
            await expect(service.update("evt-1", { capacity: 39 } as any, "cid")).rejects.toThrow(
                /40 seats already booked/,
            );
            expect(tx.save).not.toHaveBeenCalled();
            expect(gateway.emitSeatUpdate).not.toHaveBeenCalled();
        });

        it("allows lowering capacity exactly to the sold count", async () => {
            tx.findOne.mockResolvedValue(makeEvent());
            const updated = await service.update("evt-1", { capacity: 40 } as any, "cid");
            expect(updated.availableSeats).toBe(0);
        });

        it("leaves the seat counters alone when capacity is not part of the update", async () => {
            tx.findOne.mockResolvedValue(makeEvent());
            const updated = await service.update("evt-1", { title: "Renamed" } as any, "cid");
            expect(updated.availableSeats).toBe(60);
            expect(updated.capacity).toBe(100);
        });

        it("validates the resulting date window against the stored dates too", async () => {
            tx.findOne.mockResolvedValue(makeEvent());
            await expect(
                service.update("evt-1", { endDate: iso(1).toISOString() } as any, "cid"),
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it("refuses to change the currency once the event has bookings", async () => {
            tx.findOne.mockResolvedValue(makeEvent());
            tx.exists.mockResolvedValue(true);
            await expect(service.update("evt-1", { currency: "USD" } as any, "cid")).rejects.toBeInstanceOf(
                ConflictException,
            );
            expect(tx.save).not.toHaveBeenCalled();
        });

        it("allows the currency to change while there are no bookings, and ignores an unchanged one", async () => {
            tx.findOne.mockResolvedValue(makeEvent());
            await expect(service.update("evt-1", { currency: "USD" } as any, "cid")).resolves.toMatchObject({
                currency: "USD",
            });
            tx.exists.mockClear();
            tx.findOne.mockResolvedValue(makeEvent()); // fresh row: stored currency is THB
            await service.update("evt-1", { currency: "THB" } as any, "cid"); // same as stored
            expect(tx.exists).not.toHaveBeenCalled();
        });

        it("404s for an unknown event", async () => {
            tx.findOne.mockResolvedValue(null);
            await expect(service.update("nope", {} as any, "cid")).rejects.toMatchObject({ status: 404 });
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
});

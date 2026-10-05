import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { BookingsService } from '../../src/bookings/bookings.service';
import { bootApp, credentials, future } from './helpers';

describe('Events, bookings, coupons, tickets (E2E)', () => {
  let app: NestExpressApplication;
  let db: DataSource;
  const organizer = request.agent('');
  let org: ReturnType<typeof request.agent>;
  let alice: ReturnType<typeof request.agent>;
  let bob: ReturnType<typeof request.agent>;

  const signUp = async (email: string) => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/auth/register').send(credentials(email)).expect(200);
    return agent;
  };

  const newEvent = async (over: Record<string, unknown> = {}) => {
    const res = await org
      .post('/events')
      .send({
        title: 'Test Fest',
        description: 'A sufficiently long description',
        location: 'Bangkok',
        startDate: future(30),
        endDate: future(31),
        capacity: 3,
        ticketPrice: 100,
        currency: 'THB',
        ...over,
      })
      .expect(200);
    return res.body.data.id as string;
  };

  const book = (agent: typeof alice, eventId: string, extra: Record<string, unknown> = {}) =>
    agent.post('/bookings/create').send({ eventId, quantity: 1, email: 'x@test.com', firstName: 'A', lastName: 'B', ...extra });

  const seats = async (eventId: string) => (await request(app.getHttpServer()).get(`/events/${eventId}`)).body.data.availableSeats;

  beforeAll(async () => {
    ({ app, dataSource: db } = await bootApp());
    org = await signUp('org@test.com');
    await db.query(`UPDATE users SET role = 'ORGANIZER' WHERE email = 'org@test.com'`);
    // Role is cached for up to 30s; log in again to be safe.
    org = request.agent(app.getHttpServer());
    await org.post('/auth/login').send({ email: 'org@test.com', password: 'Secret123' }).expect(200);
    alice = await signUp('alice@test.com');
    bob = await signUp('bob@test.com');
  });
  afterAll(() => app.close());
  void organizer;

  it('enforces roles: customers cannot create events', async () => {
    await alice.post('/events').send({ title: 'x' }).expect(403); // authz runs before validation
  });

  it('never oversells under concurrency: 8 buyers, 3 seats -> exactly 3 succeed', async () => {
    const eventId = await newEvent({ capacity: 3 });
    const results = await Promise.all(Array.from({ length: 8 }, () => book(alice, eventId)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(3);
    expect(results.filter((r) => r.status === 400)).toHaveLength(5);
    expect(await seats(eventId)).toBe(0);
  });

  it('prices server-side, hides the client secret from others, and issues tickets only after payment', async () => {
    const eventId = await newEvent({ capacity: 10, ticketPrice: 100 });
    const created = await book(alice, eventId, { quantity: 2 }).expect(200);
    const b = created.body.data;

    expect(b.status).toBe('PENDING');
    expect(b.totalAmount).toBe(200);
    expect(b.tickets).toHaveLength(0);
    expect(b.clientSecret).toBeTruthy();

    await bob.get(`/bookings/${b.id}`).expect(404); // other users can't even see it exists
    const own = await alice.get(`/bookings/${b.id}`).expect(200);
    expect(own.body.data.clientSecret).toBeTruthy();

    const confirmed = await alice.post(`/bookings/${b.id}/confirm`).expect(200);
    expect(confirmed.body.data.status).toBe('CONFIRMED');
    expect(confirmed.body.data.tickets).toHaveLength(2);
    expect(confirmed.body.data.clientSecret).toBeUndefined();

    // Confirming twice is idempotent.
    await alice.post(`/bookings/${b.id}/confirm`).expect(200);
  });

  it('coupons: usage cap holds, rolls back with a failed booking, and returns on cancel', async () => {
    const eventId = await newEvent({ capacity: 10, ticketPrice: 100 });
    await org
      .post('/coupons')
      .send({ code: 'half', eventId, discountType: 'PERCENTAGE', discountValue: 50, maxUsages: 1, expiresAt: future(10), eventTicketPrice: 100 })
      .expect(200);

    const first = await book(alice, eventId, { couponCode: 'Half' }).expect(200);
    expect(first.body.data.finalAmount).toBe(50);
    await book(bob, eventId, { couponCode: 'HALF' }).expect(400); // cap reached
    expect(await seats(eventId)).toBe(9); // the rejected attempt leaked no seat

    await alice.delete(`/bookings/${first.body.data.id}`).expect(200);
    expect(await seats(eventId)).toBe(10);
    await book(bob, eventId, { couponCode: 'HALF' }).expect(200); // usage was returned
  });

  it('free bookings (100% coupon) confirm immediately with tickets and no payment step', async () => {
    const eventId = await newEvent({ capacity: 5, ticketPrice: 100 });
    await org
      .post('/coupons')
      .send({ code: 'free', eventId, discountType: 'PERCENTAGE', discountValue: 100, maxUsages: 5, expiresAt: future(10), eventTicketPrice: 100 })
      .expect(200);
    const res = await book(alice, eventId, { couponCode: 'FREE' }).expect(200);
    expect(res.body.data.status).toBe('CONFIRMED');
    expect(res.body.data.tickets).toHaveLength(1);
  });

  it('ticket scanning: only the organizer, only CONFIRMED bookings, and exactly once even when raced', async () => {
    const eventId = await newEvent({ capacity: 5 });
    const created = await book(alice, eventId, { quantity: 2 }).expect(200);
    const id = created.body.data.id;
    const pending = (await alice.get(`/bookings/${id}`)).body.data;
    expect(pending.tickets).toHaveLength(0);

    const paid = (await alice.post(`/bookings/${id}/confirm`).expect(200)).body.data;
    const [t1, t2] = paid.tickets;
    const scan = (agent: typeof alice, t: { id: string; qrCode: string }) =>
      agent.post('/tickets/validate').send({ ticketId: t.id, qrCode: t.qrCode });

    await scan(alice, t1).expect(403);
    expect((await scan(org, { ...t1, qrCode: 'f'.repeat(64) })).body.data.isValid).toBe(false);

    const raced = await Promise.all(Array.from({ length: 5 }, () => scan(org, t2)));
    expect(raced.filter((r) => r.body.data.isValid)).toHaveLength(1);

    await alice.delete(`/bookings/${id}`).expect(200);
    expect((await scan(org, t1)).body.data.message).toMatch(/cancelled/);
  });

  it('abandoned checkouts: the hold expires and seats come back', async () => {
    const eventId = await newEvent({ capacity: 2 });
    const created = await book(alice, eventId, { quantity: 2 }).expect(200);
    expect(await seats(eventId)).toBe(0);

    await db.query(`UPDATE bookings SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`, [created.body.data.id]);
    const expired = await app.get(BookingsService).expireStaleHolds();

    expect(expired).toBe(1);
    expect(await seats(eventId)).toBe(2);
    const status = (await db.query('SELECT status FROM bookings WHERE id = $1', [created.body.data.id]))[0].status;
    expect(status).toBe('EXPIRED');
  });

  it('capacity cannot be lowered below the seats already sold', async () => {
    const eventId = await newEvent({ capacity: 5 });
    await book(alice, eventId, { quantity: 3 }).expect(200);
    await org.put(`/events/${eventId}`).send({ capacity: 2 }).expect(400);
    await org.put(`/events/${eventId}`).send({ capacity: 8 }).expect(200);
    expect(await seats(eventId)).toBe(5);
  });

  it('events with bookings cannot be deleted (409, history preserved)', async () => {
    const eventId = await newEvent();
    await book(alice, eventId).expect(200);
    await org.delete(`/events/${eventId}`).expect(409);
  });
});

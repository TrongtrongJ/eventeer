/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';

describe('Complete Booking Flow (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let organizerToken: string;
  let eventId: string;
  let bookingId: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Clean database before tests
    await dataSource.query('DELETE FROM tickets');
    await dataSource.query('DELETE FROM bookings');
    await dataSource.query('DELETE FROM events');
    await dataSource.query('DELETE FROM sessions');
    await dataSource.query('DELETE FROM users');
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  describe('1. User Registration & Authentication', () => {
    it('should register a new customer user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'customer@test.com',
          password: 'Test123!@#',
          firstName: 'John',
          lastName: 'Customer',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('customer@test.com');
      expect(response.body.data.user.role).toBe('CUSTOMER');

      accessToken = response.body.data.accessToken;
      userId = response.body.data.user.id;
    });

    it('should not allow duplicate email registration', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'customer@test.com',
          password: 'Test123!@#',
          firstName: 'John',
          lastName: 'Duplicate',
        })
        .expect(409);
    });

    it('should register an organizer user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'organizer@test.com',
          password: 'Test123!@#',
          firstName: 'Jane',
          lastName: 'Organizer',
        })
        .expect(201);

      // Manually promote to organizer
      await dataSource.query(
        `UPDATE users SET role = 'ORGANIZER' WHERE email = 'organizer@test.com'`,
      );

      // Login to get new token with updated role
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'organizer@test.com',
          password: 'Test123!@#',
        })
        .expect(200);

      organizerToken = loginResponse.body.data.accessToken;
    });

    it('should login with correct credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'customer@test.com',
          password: 'Test123!@#',
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('accessToken');
      accessToken = response.body.data.accessToken;
    });

    it('should fail login with incorrect password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'customer@test.com',
          password: 'WrongPassword',
        })
        .expect(401);
    });
  });

  describe('2. Event Creation (Organizer)', () => {
    it('should not allow customer to create event', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test Event',
          description: 'This should fail',
          location: 'Test Location',
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 172800000).toISOString(),
          capacity: 100,
          ticketPrice: 50,
          currency: 'USD',
        })
        .expect(403);
    });

    it('should allow organizer to create event', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Tech Conference 2025',
          description: 'Annual technology conference with exciting speakers',
          location: 'San Francisco, CA',
          startDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 172800000).toISOString(),
          capacity: 100,
          ticketPrice: 99.99,
          currency: 'USD',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Tech Conference 2025');
      expect(response.body.data.availableSeats).toBe(100);
      eventId = response.body.data.id;
    });

    it('should validate event creation data', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Ab', // Too short
          description: 'Short', // Too short
          location: 'SF',
          startDate: 'invalid-date',
          capacity: -10, // Negative
          ticketPrice: 0, // Zero
        })
        .expect(400);

      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('3. Event Browsing (Public)', () => {
    it('should allow unauthenticated users to browse events', async () => {
      const response = await request(app.getHttpServer())
        .get('/events')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get event details by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .expect(200);

      expect(response.body.data.id).toBe(eventId);
      expect(response.body.data.title).toBe('Tech Conference 2025');
    });

    it('should return 404 for non-existent event', async () => {
      await request(app.getHttpServer())
        .get('/events/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('4. Booking Creation (Authenticated)', () => {
    it('should not allow unauthenticated booking', async () => {
      await request(app.getHttpServer())
        .post('/bookings')
        .send({
          eventId,
          quantity: 2,
          email: 'test@test.com',
          firstName: 'John',
          lastName: 'Doe',
        })
        .expect(401);
    });

    it('should create booking successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          eventId,
          quantity: 2,
          email: 'customer@test.com',
          firstName: 'John',
          lastName: 'Customer',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity).toBe(2);
      expect(response.body.data.status).toBe('PENDING');
      expect(response.body.data.tickets).toHaveLength(2);
      expect(response.body.data).toHaveProperty('clientSecret');
      
      bookingId = response.body.data.id;

      // Verify each ticket has QR code
      response.body.data.tickets.forEach((ticket) => {
        expect(ticket).toHaveProperty('ticketNumber');
        expect(ticket).toHaveProperty('qrCode');
        expect(ticket.isValidated).toBe(false);
      });
    });

    it('should update event available seats after booking', async () => {
      const response = await request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .expect(200);

      expect(response.body.data.availableSeats).toBe(98); // 100 - 2
    });

    it('should not allow booking more than available seats', async () => {
      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          eventId,
          quantity: 200, // More than available
          email: 'customer@test.com',
          firstName: 'John',
          lastName: 'Customer',
        })
        .expect(400);
    });

    it('should validate booking input', async () => {
      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          eventId,
          quantity: -1, // Negative quantity
          email: 'invalid-email',
          firstName: '',
          lastName: '',
        })
        .expect(400);
    });
  });

  describe('5. Booking Confirmation & Payment', () => {
    it('should confirm booking after payment', async () => {
      // Wait for mock payment to auto-succeed (2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const response = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CONFIRMED');
    });

    it('should not allow confirming already confirmed booking', async () => {
      const response = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should return the already confirmed booking
      expect(response.body.data.status).toBe('CONFIRMED');
    });
  });

  describe('6. Booking Retrieval', () => {
    it('should get booking by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(bookingId);
      expect(response.body.data.status).toBe('CONFIRMED');
    });

    it('should not allow viewing other users bookings', async () => {
      // Create another user
      const otherUserResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'other@test.com',
          password: 'Test123!@#',
          firstName: 'Other',
          lastName: 'User',
        })
        .expect(201);

      const otherToken = otherUserResponse.body.data.accessToken;

      // Try to access first user's booking
      await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should get all bookings for current user', async () => {
      const response = await request(app.getHttpServer())
        .get('/bookings/my/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].userId).toBe(userId);
    });
  });

  describe('7. Ticket Validation', () => {
    let ticketId: string;
    let qrCode: string;

    beforeAll(async () => {
      const bookingResponse = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      ticketId = bookingResponse.body.data.tickets[0].id;
      qrCode = bookingResponse.body.data.tickets[0].qrCode;
    });

    it('should validate ticket successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/tickets/validate')
        .set('Authorization', `Bearer ${organizerToken}`) // Organizer validating
        .send({
          ticketId,
          qrCode,
        })
        .expect(200);

      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.ticket).toHaveProperty('ticketNumber');
      expect(response.body.data.ticket).toHaveProperty('validatedAt');
    });

    it('should not validate already used ticket', async () => {
      const response = await request(app.getHttpServer())
        .post('/tickets/validate')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          ticketId,
          qrCode,
        })
        .expect(200);

      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.message).toContain('already used');
    });

    it('should not validate ticket with wrong QR code', async () => {
      const response = await request(app.getHttpServer())
        .post('/tickets/validate')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          ticketId,
          qrCode: 'wrong-qr-code',
        })
        .expect(200);

      expect(response.body.data.isValid).toBe(false);
    });
  });

  describe('8. Booking Cancellation', () => {
    let cancellableBookingId: string;

    beforeAll(async () => {
      // Create a new booking to cancel
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          eventId,
          quantity: 1,
          email: 'customer@test.com',
          firstName: 'John',
          lastName: 'Customer',
        })
        .expect(201);

      cancellableBookingId = response.body.data.id;

      // Confirm it
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await request(app.getHttpServer())
        .post(`/bookings/${cancellableBookingId}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should cancel booking successfully', async () => {
      const seatsBefore = await request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/bookings/${cancellableBookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify seats restored
      const seatsAfter = await request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .expect(200);

      expect(seatsAfter.body.data.availableSeats).toBe(
        seatsBefore.body.data.availableSeats + 1,
      );
    });

    it('should not allow cancelling other users bookings', async () => {
      const otherUserResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'another@test.com',
          password: 'Test123!@#',
          firstName: 'Another',
          lastName: 'User',
        })
        .expect(201);

      const otherToken = otherUserResponse.body.data.accessToken;

      await request(app.getHttpServer())
        .delete(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });

  describe('9. Event Management (Organizer)', () => {
    it('should allow organizer to update own event', async () => {
      const response = await request(app.getHttpServer())
        .put(`/events/${eventId}`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({
          title: 'Tech Conference 2025 - Updated',
          ticketPrice: 109.99,
        })
        .expect(200);

      expect(response.body.data.title).toBe('Tech Conference 2025 - Updated');
      expect(response.body.data.ticketPrice).toBe(109.99);
    });

    it('should not allow customer to update event', async () => {
      await request(app.getHttpServer())
        .put(`/events/${eventId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Hacked Event',
        })
        .expect(403);
    });

    it('should allow organizer to view bookings for their event', async () => {
      const response = await request(app.getHttpServer())
        .get(`/bookings/event/${eventId}/bookings`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('10. Token Refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'customer@test.com',
          password: 'Test123!@#',
        })
        .expect(200);

      refreshToken = response.body.data.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should fail with invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);
    });
  });

  describe('11. Logout', () => {
    it('should logout successfully', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });
  });
});
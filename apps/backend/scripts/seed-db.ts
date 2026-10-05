/**
 * Demo data: one admin, two organizers, two customers, a handful of future events
 * and coupons. Idempotent: skips if the demo admin already exists.
 *
 *   yarn seed:demo          # add demo data
 *   yarn seed:demo --reset  # wipe all data first (development only)
 */
import bcrypt from '@node-rs/bcrypt';
import dataSource from '../src/config/data-source';
import { User, UserRole, AuthProvider } from '../src/entities/user.entity';
import { Event } from '../src/entities/event.entity';
import { Coupon, DiscountType } from '../src/entities/coupon.entity';

const DAY = 24 * 3600 * 1000;
const inDays = (n: number, hours = 0) => new Date(Date.now() + n * DAY + hours * 3600 * 1000);

const USERS = [
  { email: 'admin@demo.com', password: 'Admin123!', firstName: 'Ada', lastName: 'Admin', role: UserRole.ADMIN },
  { email: 'organizer@demo.com', password: 'Organizer123!', firstName: 'Olivia', lastName: 'Organizer', role: UserRole.ORGANIZER },
  { email: 'organizer2@demo.com', password: 'Organizer123!', firstName: 'Owen', lastName: 'Organizer', role: UserRole.ORGANIZER },
  { email: 'customer@demo.com', password: 'Customer123!', firstName: 'Casey', lastName: 'Customer', role: UserRole.CUSTOMER },
  { email: 'customer2@demo.com', password: 'Customer123!', firstName: 'Chris', lastName: 'Customer', role: UserRole.CUSTOMER },
];

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database');

  await dataSource.initialize();
  await dataSource.runMigrations();

  if (process.argv.includes('--reset')) {
    await dataSource.query('TRUNCATE TABLE tickets, bookings, coupons, events, auth_sessions, users RESTART IDENTITY CASCADE');
    console.log('Existing data wiped');
  }

  const users = dataSource.getRepository(User);
  if (await users.exists({ where: { email: 'admin@demo.com' } })) {
    console.log('Demo data already present (use --reset to rebuild)');
    return dataSource.destroy();
  }

  const saved: Record<string, User> = {};
  for (const u of USERS) {
    saved[u.email] = await users.save(
      users.create({
        email: u.email,
        passwordHash: await bcrypt.hash(u.password, 12),
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        provider: AuthProvider.LOCAL,
        isEmailVerified: true,
        isActive: true,
      }),
    );
  }

  const events = dataSource.getRepository(Event);
  const mk = (organizer: string, title: string, location: string, days: number, capacity: number, price: number, description: string, imageUrl: string) =>
    events.save(
      events.create({
        title,
        description,
        location,
        startDate: inDays(days, 19),
        endDate: inDays(days, 23),
        capacity,
        availableSeats: capacity,
        ticketPrice: price,
        currency: 'THB',
        organizerId: saved[organizer].id,
        imageUrl,
      }),
    );

  const [rock, tech, jazz] = await Promise.all([
    mk('organizer@demo.com', 'Bangkok Rock Night', 'Impact Arena, Bangkok', 14, 500, 1200, 'A full night of live rock from regional bands.', "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800"),
    mk('organizer@demo.com', 'Thailand Dev Summit', 'QSNCC, Bangkok', 30, 300, 2500, 'Talks and workshops on modern backend and cloud engineering.', "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800"),
    mk('organizer2@demo.com', 'Chiang Mai Jazz Evening', 'Nimman Hall, Chiang Mai', 21, 120, 800, 'An intimate evening of live jazz.', "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800"),
  ]);
  await mk('organizer2@demo.com', 'Free Community Meetup', 'Co-working Space, Phuket', 7, 60, 0, 'A free community meetup: no payment step.', "https://images.unsplash.com/photo-1576085898323-218337e3e43c?w=800");

  const coupons = dataSource.getRepository(Coupon);
  await coupons.save([
    coupons.create({ code: 'EARLY20', eventId: rock.id, discountType: DiscountType.PERCENTAGE, discountValue: 20, maxUsages: 50, expiresAt: inDays(10) }),
    coupons.create({ code: 'DEV500', eventId: tech.id, discountType: DiscountType.FIXED, discountValue: 500, maxUsages: 20, expiresAt: inDays(25), minPurchaseAmount: 2000 }),
    coupons.create({ code: 'FREEJAZZ', eventId: jazz.id, discountType: DiscountType.PERCENTAGE, discountValue: 100, maxUsages: 5, expiresAt: inDays(15) }),
  ]);

  console.log('Seeded. Demo logins:');
  USERS.forEach((u) => console.log(`  ${u.role.padEnd(9)} ${u.email.padEnd(22)} ${u.password}`));
  await dataSource.destroy();
}

main().catch(async (err) => {
  console.error(err);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exit(1);
});

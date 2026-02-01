import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });

console.log('Target Env Path:', envPath);
console.log('DB Host:', process.env.DATABASE_HOST);

// Database configuration
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'event_management',
  entities: ['dist/entities/*.entity.js'],
  synchronize: false,
});

// User roles
enum UserRole {
  ADMIN = 'ADMIN',
  ORGANIZER = 'ORGANIZER',
  CUSTOMER = 'CUSTOMER',
}

enum AuthProvider {
  LOCAL = 'LOCAL',
}

enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

interface UserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

interface EventData {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  capacity: number;
  ticketPrice: number;
  currency: string;
  imageUrl?: string;
}

interface CouponData {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxUsages: number;
  expiresAt: Date;
  minPurchaseAmount?: number;
}

class DatabaseSeeder {
  private dataSource: DataSource;
  private userIds: Map<string, string> = new Map();
  private eventIds: Map<string, string> = new Map();

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  async seed() {
    console.log('🌱 Starting database seeding...\n');

    try {
      // Clear existing data (optional - comment out if you want to keep existing data)
      await this.clearDatabase();

      // Seed in order (due to foreign key constraints)
      await this.seedUsers();
      await this.seedEvents();
      await this.seedCoupons();
      await this.seedBookings();

      console.log('\n✅ Database seeding completed successfully!');
      this.printSummary();
    } catch (error) {
      console.error('❌ Error seeding database:', error);
      throw error;
    }
  }

  private async clearDatabase() {
    console.log('🗑️  Clearing existing data...');
    
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Disable foreign key checks temporarily
      await queryRunner.query('SET session_replication_role = replica;');

      // Delete in reverse order of dependencies
      await queryRunner.query('DELETE FROM tickets');
      await queryRunner.query('DELETE FROM bookings');
      await queryRunner.query('DELETE FROM coupons');
      await queryRunner.query('DELETE FROM events');
      await queryRunner.query('DELETE FROM sessions');
      await queryRunner.query('DELETE FROM users');

      // Re-enable foreign key checks
      await queryRunner.query('SET session_replication_role = DEFAULT;');

      console.log('   ✓ Database cleared\n');
    } finally {
      await queryRunner.release();
    }
  }

  private async seedUsers() {
    console.log('👤 Seeding users...');

    const users: UserData[] = [
      {
        email: 'admin@demo.com',
        password: 'Admin123!',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
      },
      {
        email: 'organizer@demo.com',
        password: 'Organizer123!',
        firstName: 'Event',
        lastName: 'Organizer',
        role: UserRole.ORGANIZER,
      },
      {
        email: 'organizer2@demo.com',
        password: 'Organizer123!',
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: UserRole.ORGANIZER,
      },
      {
        email: 'customer@demo.com',
        password: 'Customer123!',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.CUSTOMER,
      },
      {
        email: 'customer2@demo.com',
        password: 'Customer123!',
        firstName: 'Jane',
        lastName: 'Smith',
        role: UserRole.CUSTOMER,
      },
      {
        email: 'customer3@demo.com',
        password: 'Customer123!',
        firstName: 'Michael',
        lastName: 'Brown',
        role: UserRole.CUSTOMER,
      },
    ];

    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const userId = crypto.randomUUID();

      await this.dataSource.query(
        `INSERT INTO users (id, email, password, "firstName", "lastName", role, "isEmailVerified", "isActive", provider, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         ON CONFLICT (email) DO NOTHING`,
        [
          userId,
          userData.email,
          hashedPassword,
          userData.firstName,
          userData.lastName,
          userData.role,
          true, // isEmailVerified
          true, // isActive
          AuthProvider.LOCAL,
        ]
      );

      // Store user ID for reference
      this.userIds.set(userData.email, userId);

      console.log(`   ✓ Created ${userData.role}: ${userData.email}`);
    }

    console.log('');
  }

  private async seedEvents() {
    console.log('🎉 Seeding events...');

    const organizerId = this.userIds.get('organizer@demo.com')!;
    const organizer2Id = this.userIds.get('organizer2@demo.com')!;

    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()

    const events: EventData[] = [
      {
        title: 'Tech Conference 2025',
        description: 'Join us for the biggest tech conference of the year! Featuring keynotes from industry leaders, hands-on workshops, and networking opportunities. Learn about the latest in AI, cloud computing, and software development.',
        location: 'San Francisco, CA - Moscone Center',
        startDate: new Date('2025-06-15T09:00:00Z'),
        endDate: new Date('2025-06-17T18:00:00Z'),
        capacity: 500,
        ticketPrice: 299.99,
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800',
      },
      {
        title: 'Summer Music Festival',
        description: 'Three days of non-stop music featuring over 50 artists across multiple stages. From indie rock to electronic dance music, experience the best live performances of the summer.',
        location: 'Austin, TX - Zilker Park',
        startDate: new Date('2025-07-20T14:00:00Z'),
        endDate: new Date('2025-07-22T23:00:00Z'),
        capacity: 10000,
        ticketPrice: 199.99,
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800',
      },
      {
        title: 'Business Networking Mixer',
        description: 'Connect with industry professionals, entrepreneurs, and investors. Perfect for expanding your professional network and discovering new business opportunities.',
        location: 'New York, NY - WeWork Times Square',
        startDate: new Date('2025-05-10T18:00:00Z'),
        endDate: new Date('2025-05-10T22:00:00Z'),
        capacity: 200,
        ticketPrice: 49.99,
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
      },
      {
        title: 'Food & Wine Tasting',
        description: 'Sample exquisite dishes from Michelin-starred chefs paired with premium wines from around the world. A culinary journey you won\'t forget.',
        location: 'Portland, OR - The Nines Hotel',
        startDate: new Date('2025-08-05T19:00:00Z'),
        endDate: new Date('2025-08-05T23:00:00Z'),
        capacity: 150,
        ticketPrice: 89.99,
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
      },
      {
        title: 'Startup Pitch Competition',
        description: 'Watch innovative startups pitch their ideas to a panel of top venture capitalists. $100K prize pool for winners. Open to audience and participants.',
        location: 'Seattle, WA - Amazon Spheres',
        startDate: new Date('2025-09-15T10:00:00Z'),
        endDate: new Date('2025-09-15T17:00:00Z'),
        capacity: 300,
        ticketPrice: 0, // Free event
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800',
      },
      {
        title: 'Art Gallery Opening',
        description: 'Exclusive opening of contemporary art exhibition featuring emerging artists. Meet the artists, enjoy wine and hors d\'oeuvres, and be the first to view these stunning works.',
        location: 'Los Angeles, CA - The Broad Museum',
        startDate: new Date('2025-10-01T18:00:00Z'),
        endDate: new Date('2025-10-01T22:00:00Z'),
        capacity: 250,
        ticketPrice: 35.00,
        currency: 'USD',
        imageUrl: 'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?w=800',
      },
    ];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventId = crypto.randomUUID();
      
      // Alternate between 2 tempalate organizers
      const currentOrganizerId = i % 2 === 0 ? organizerId : organizer2Id;

      await this.dataSource.query(
        `INSERT INTO events (id, title, description, location, "startDate", "endDate", capacity, "availableSeats", "ticketPrice", currency, "imageUrl", "organizerId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
        [
          eventId,
          event.title,
          event.description,
          event.location,
          event.startDate,
          event.endDate,
          event.capacity,
          event.capacity, // availableSeats = capacity initially
          event.ticketPrice,
          event.currency,
          event.imageUrl,
          currentOrganizerId,
        ]
      );

      this.eventIds.set(event.title, eventId);
      console.log(`   ✓ Created event: ${event.title}`);
    }

    console.log('');
  }

  private async seedCoupons() {
    console.log('🎟️  Seeding coupons...');

    const techConfId = this.eventIds.get('Tech Conference 2025')!;
    const musicFestId = this.eventIds.get('Summer Music Festival')!;
    const networkingId = this.eventIds.get('Business Networking Mixer')!;

    const coupons: Array<CouponData & { eventId: string }> = [
      {
        eventId: techConfId,
        code: 'EARLYBIRD20',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
        maxUsages: 100,
        expiresAt: new Date('2025-05-01T00:00:00Z'),
        minPurchaseAmount: 100,
      },
      {
        eventId: techConfId,
        code: 'TECH50OFF',
        discountType: DiscountType.FIXED,
        discountValue: 50,
        maxUsages: 50,
        expiresAt: new Date('2025-06-01T00:00:00Z'),
      },
      {
        eventId: musicFestId,
        code: 'SUMMER30',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 30,
        maxUsages: 200,
        expiresAt: new Date('2025-07-01T00:00:00Z'),
      },
      {
        eventId: networkingId,
        code: 'NETWORK10',
        discountType: DiscountType.FIXED,
        discountValue: 10,
        maxUsages: 75,
        expiresAt: new Date('2025-05-01T00:00:00Z'),
      },
      {
        eventId: musicFestId,
        code: 'VIP100',
        discountType: DiscountType.FIXED,
        discountValue: 100,
        maxUsages: 10,
        expiresAt: new Date('2025-07-15T00:00:00Z'),
        minPurchaseAmount: 150,
      },
    ];

    for (const coupon of coupons) {
      const couponId = crypto.randomUUID();

      await this.dataSource.query(
        `INSERT INTO coupons (id, code, "eventId", "discountType", "discountValue", "maxUsages", "currentUsages", "expiresAt", "minPurchaseAmount", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [
          couponId,
          coupon.code,
          coupon.eventId,
          coupon.discountType,
          coupon.discountValue,
          coupon.maxUsages,
          0, // currentUsages
          coupon.expiresAt,
          coupon.minPurchaseAmount || null,
          true, // isActive
        ]
      );

      console.log(`   ✓ Created coupon: ${coupon.code}`);
    }

    console.log('');
  }

  private async seedBookings() {
    console.log('🎫 Seeding sample bookings...');

    const customerId = this.userIds.get('customer@demo.com')!;
    const customer2Id = this.userIds.get('customer2@demo.com')!;
    const techConfId = this.eventIds.get('Tech Conference 2025')!;
    const musicFestId = this.eventIds.get('Summer Music Festival')!;

    // Booking 1: Tech Conference with coupon
    const booking1Id = crypto.randomUUID();
    const totalAmount1 = 299.99 * 2; // 2 tickets
    const discount1 = totalAmount1 * 0.20; // 20% off
    const finalAmount1 = totalAmount1 - discount1;

    await this.dataSource.query(
      `INSERT INTO bookings (id, "eventId", "userId", quantity, email, "firstName", "lastName", "totalAmount", "finalAmount", discount, "couponCode", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
      [
        booking1Id,
        techConfId,
        customerId,
        2,
        'customer@demo.com',
        'John',
        'Doe',
        totalAmount1,
        finalAmount1,
        discount1,
        'EARLYBIRD20',
        'CONFIRMED',
      ]
    );

    // Create tickets for booking 1
    await this.createTickets(booking1Id, 2);
    console.log('   ✓ Created booking with 2 tickets (Tech Conference)');

    // Update coupon usage
    await this.dataSource.query(
      `UPDATE coupons SET "currentUsages" = "currentUsages" + 1 WHERE code = $1`,
      ['EARLYBIRD20']
    );

    // Update event available seats
    await this.dataSource.query(
      `UPDATE events SET "availableSeats" = "availableSeats" - $1 WHERE id = $2`,
      [2, techConfId]
    );

    // Booking 2: Music Festival
    const booking2Id = crypto.randomUUID();
    const totalAmount2 = 199.99 * 4; // 4 tickets
    const finalAmount2 = totalAmount2;

    await this.dataSource.query(
      `INSERT INTO bookings (id, "eventId", "userId", quantity, email, "firstName", "lastName", "totalAmount", "finalAmount", discount, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [
        booking2Id,
        musicFestId,
        customer2Id,
        4,
        'customer2@demo.com',
        'Jane',
        'Smith',
        totalAmount2,
        finalAmount2,
        0,
        'CONFIRMED',
      ]
    );

    await this.createTickets(booking2Id, 4);
    console.log('   ✓ Created booking with 4 tickets (Music Festival)');

    // Update event available seats
    await this.dataSource.query(
      `UPDATE events SET "availableSeats" = "availableSeats" - $1 WHERE id = $2`,
      [4, musicFestId]
    );

    console.log('');
  }

  private async createTickets(bookingId: string, quantity: number) {
    for (let i = 0; i < quantity; i++) {
      const ticketId = crypto.randomUUID();
      const ticketNumber = `TKT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const qrCode = crypto.createHash('sha256')
        .update(`${bookingId}:${ticketNumber}:${Date.now()}`)
        .digest('hex');

      await this.dataSource.query(
        `INSERT INTO tickets (id, "bookingId", "ticketNumber", "qrCode", "isValidated", "createdAt")
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [ticketId, bookingId, ticketNumber, qrCode, false]
      );
    }
  }

  private printSummary() {
    console.log('\n📊 Seeding Summary:');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Users created:    ${this.userIds.size}`);
    console.log(`Events created:   ${this.eventIds.size}`);
    console.log(`Coupons created:  5`);
    console.log(`Bookings created: 2 (with 6 total tickets)`);
    console.log('═══════════════════════════════════════════════════\n');

    console.log('🔑 Demo Accounts:');
    console.log('─────────────────────────────────────────────────');
    console.log('Role      | Email                  | Password');
    console.log('─────────────────────────────────────────────────');
    console.log('Admin     | admin@demo.com         | Admin123!');
    console.log('Organizer | organizer@demo.com     | Organizer123!');
    console.log('Organizer | organizer2@demo.com    | Organizer123!');
    console.log('Customer  | customer@demo.com      | Customer123!');
    console.log('Customer  | customer2@demo.com     | Customer123!');
    console.log('Customer  | customer3@demo.com     | Customer123!');
    console.log('─────────────────────────────────────────────────\n');

    console.log('🎟️  Active Coupons:');
    console.log('─────────────────────────────────────────────────');
    console.log('EARLYBIRD20 - 20% off Tech Conference (min $100)');
    console.log('TECH50OFF   - $50 off Tech Conference');
    console.log('SUMMER30    - 30% off Music Festival');
    console.log('NETWORK10   - $10 off Networking Mixer');
    console.log('VIP100      - $100 off Music Festival (min $150)');
    console.log('─────────────────────────────────────────────────\n');
  }
}

// Main execution
async function main() {
  console.log('🚀 Event Management Database Seeder\n');

  try {
    await AppDataSource.initialize();
    console.log('✅ Database connection established\n');

    const seeder = new DatabaseSeeder(AppDataSource);
    await seeder.seed();

    await AppDataSource.destroy();
    console.log('👋 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('💥 Fatal error:', error);
    await AppDataSource.destroy();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { DatabaseSeeder };
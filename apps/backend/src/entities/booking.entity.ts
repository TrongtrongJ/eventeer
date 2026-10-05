import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Event } from './event.entity';
import { Ticket } from './ticket.entity';
import { User } from './user.entity';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
  /** Hold lapsed before payment completed; seats were released. */
  EXPIRED = 'EXPIRED',
}

@Entity('bookings')
@Index(['status', 'expiresAt'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, (event) => event.bookings, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  finalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  couponCode?: string;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Index({ unique: true, where: '"paymentIntentId" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  paymentIntentId?: string;

  @OneToMany(() => Ticket, (ticket) => ticket.booking, { cascade: true })
  tickets: Ticket[];

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => User, (user) => user.bookings, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  /** Stripe client secrets are ~60+ chars; the old varchar(50) would have overflowed. */
  @Column({ type: 'text', nullable: true })
  clientSecret?: string | null;

  /** Seat-hold deadline for PENDING bookings. Null once settled. */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

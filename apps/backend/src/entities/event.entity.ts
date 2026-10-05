import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Booking } from './booking.entity';
import { Coupon } from './coupon.entity';
import { User } from './user.entity';

@Entity('events')
@Check('"availableSeats" >= 0 AND "availableSeats" <= "capacity"')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 500 })
  location: string;

  @Index()
  @Column({ type: 'timestamptz' })
  startDate: Date;

  @Column({ type: 'timestamptz' })
  endDate: Date;

  @Column({ type: 'int' })
  capacity: number;

  /**
   * Mutated only via single-statement atomic UPDATEs (see EventsService), and
   * backstopped by the CHECK constraint above so overselling is impossible
   * even if application logic regresses.
   */
  @Column({ type: 'int' })
  availableSeats: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  ticketPrice: number;

  @Column({ type: 'varchar', length: 3, default: 'THB' })
  currency: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  imageUrl?: string;

  @OneToMany(() => Booking, (booking) => booking.event)
  bookings: Booking[];

  @OneToMany(() => Coupon, (coupon) => coupon.event)
  coupons: Coupon[];

  @Index()
  @Column({ type: 'uuid', nullable: true })
  organizerId?: string;

  @ManyToOne(() => User, (user) => user.organizedEvents, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organizerId' })
  organizer?: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

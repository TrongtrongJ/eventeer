import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Booking } from './booking.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  ticketNumber: string;

  /** 256-bit random value rendered as the QR code. Unguessable, unique. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  qrCode: string;

  @Column({ type: 'boolean', default: false })
  isValidated: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  validatedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

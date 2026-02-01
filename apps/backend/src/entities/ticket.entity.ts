import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Booking } from "./booking.entity";

@Entity("tickets")
export class Ticket {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.tickets)
  @JoinColumn({ name: "bookingId" })
  booking: Booking;

  @Column({ type: "varchar", length: 50, unique: true })
  @Index()
  ticketNumber: string;

  @Column({ type: "text", unique: true })
  @Index()
  qrCode: string;

  @Column({ type: "boolean", default: false })
  isValidated: boolean;

  @Column({ type: "timestamp", nullable: true })
  validatedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}

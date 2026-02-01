import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Booking } from "./booking.entity";
import { Coupon } from "./coupon.entity";
import { User } from './user.entity';

@Entity("events")
export class Event {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "varchar", length: 500 })
  location: string;

  @Column({ type: "timestamp" })
  startDate: Date;

  @Column({ type: "timestamp" })
  endDate: Date;

  @Column({ type: "int" })
  capacity: number;

  @Column({ type: "int" })
  availableSeats: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  ticketPrice: number;

  @Column({ type: "varchar", length: 3, default: "USD" })
  currency: string;

  @Column({ type: "varchar", nullable: true })
  imageUrl?: string;

  @OneToMany(() => Booking, (booking) => booking.event)
  bookings: Booking[];

  @OneToMany(() => Coupon, (coupon) => coupon.event)
  coupons: Coupon[];

  @Column({ type: 'uuid', nullable: true })
  organizerId?: string;

  @ManyToOne(() => User, user => user.organizedEvents)
  @JoinColumn({ name: 'organizerId' })
  organizer?: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "int", default: 0 })
  version: number;
}

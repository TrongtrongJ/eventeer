import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Event } from "./event.entity";

export enum DiscountType {
  PERCENTAGE = "PERCENTAGE",
  FIXED = "FIXED",
}

@Entity("coupons")
@Index(["code", "eventId"], { unique: true })
export class Coupon {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 50 })
  code: string;

  @Column({ type: "uuid" })
  eventId: string;

  @ManyToOne(() => Event, (event) => event.coupons)
  @JoinColumn({ name: "eventId" })
  event: Event;

  @Column({ type: "enum", enum: DiscountType })
  discountType: DiscountType;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  discountValue: number;

  @Column({ type: "int" })
  maxUsages: number;

  @Column({ type: "int", default: 0 })
  currentUsages: number;

  @Column({ type: "timestamp" })
  expiresAt: Date;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  minPurchaseAmount?: number;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: "int", default: 0 })
  version: number;
}

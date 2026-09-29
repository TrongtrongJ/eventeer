import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { Booking } from './booking.entity';
import { Event } from './event.entity';
import { Session } from './session.entity';
import { RefreshToken } from '../users/refresh-token.entity';

export enum UserRole {
  ADMIN = 'ADMIN',
  ORGANIZER = 'ORGANIZER',
  CUSTOMER = 'CUSTOMER',
}

export enum AuthProvider {
  LOCAL = 'LOCAL',
  GOOGLE = 'GOOGLE',
  GITHUB = 'GITHUB',
  FACEBOOK = 'FACEBOOK',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email: string;

  //@Column({ type: 'varchar', length: 255, nullable: true })
  // password?: string; // Nullable for OAuth users

  @Column({ type: "varchar", name: "password_hash", nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatarUrl?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  provider: AuthProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerId?: string; // OAuth provider user ID

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  emailVerificationToken?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires?: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordResetToken?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpires?: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @OneToMany(() => Booking, booking => booking.user)
  bookings?: Booking[];

  @OneToMany(() => Event, event => event.organizer)
  organizedEvents?: Event[];

  @OneToMany(() => Session, session => session.user)
  sessions?: Session[];

  @OneToMany(() => RefreshToken, rt => rt.user, { cascade: true })
  refreshTokens?: RefreshToken[];

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, any>; // For storing OAuth profile data

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Booking } from './booking.entity';
import { Event } from './event.entity';
import { RefreshToken } from '../users/refresh-token.entity';
import { Session } from './session.entity';

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
@Index(['provider', 'providerId'], { unique: true, where: '"providerId" IS NOT NULL' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Always stored lower-cased (normalised at the schema boundary). */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  /** bcrypt hash; null for OAuth-only accounts. */
  @Column({ type: 'varchar', name: 'password_hash', nullable: true })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatarUrl?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  provider: AuthProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerId?: string;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  /** SHA-256 of the emailed token. The raw token is never persisted. */
  @Index()
  @Column({ type: 'char', length: 64, nullable: true })
  emailVerificationToken?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerificationExpires?: Date | null;

  /** SHA-256 of the emailed token. The raw token is never persisted. */
  @Index()
  @Column({ type: 'char', length: 64, nullable: true })
  passwordResetToken?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  passwordResetExpires?: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @OneToMany(() => Booking, (booking) => booking.user)
  bookings?: Booking[];

  @OneToMany(() => Event, (event) => event.organizer)
  organizedEvents?: Event[];

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens?: RefreshToken[];

  @OneToMany(() => Session, (session) => session.user)
  sessions?: Session[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

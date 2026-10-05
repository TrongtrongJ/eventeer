import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

/**
 * One row per login (device). Holds the SHA-256 *hashes* of the current opaque
 * access and refresh tokens; the raw values exist only in the client's httpOnly
 * cookies. Tokens are 256 bits of CSPRNG output, so a plain fast hash is
 * sufficient (there is nothing to brute-force) and lookups are a single
 * unique-index hit.
 *
 * Refresh rotation swaps both hashes in place and remembers the previous
 * refresh hash so that replaying an already-rotated token is detectable.
 */
@Entity('auth_sessions')
@Index(['userId', 'revokedAt'])
export class AuthSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  accessTokenHash: string;

  @Column({ type: 'timestamptz' })
  accessExpiresAt: Date;

  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  refreshTokenHash: string;

  @Column({ type: 'timestamptz' })
  refreshExpiresAt: Date;

  @Index()
  @Column({ type: 'char', length: 64, nullable: true })
  previousRefreshTokenHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  rotatedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

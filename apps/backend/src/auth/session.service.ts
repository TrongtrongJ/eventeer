import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import { In, IsNull, LessThan, Not, Repository } from 'typeorm';
import type { CurrentUserData } from '@packages/shared-schemas';
import { AuthSession } from '../entities/auth-session.entity';
import type { User } from '../entities/user.entity';
import type { EnvConfig } from '../env.validation';
import { generateToken, hashToken } from './utils/token.util';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

export interface SessionMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface RotationResult {
  user: User;
  sessionId: string;
  /**
   * null when the presented token was rotated moments ago by a concurrent
   * request (e.g. SSR + browser racing). The winner already delivered fresh
   * cookies, so the loser must not (and cannot) mint different ones.
   */
  tokens: IssuedTokens | null;
}

interface CachedPrincipal extends CurrentUserData {
  exp: number;
}

/**
 * Server-side opaque-token sessions backed by Postgres, with a short-lived
 * Redis read-through cache on access-token lookups.
 *
 * Security properties:
 *  - Tokens are random, never parsed, and never stored raw (SHA-256 only).
 *  - Refresh tokens rotate on every use; replaying a rotated token outside a
 *    short grace window revokes the whole session (theft detection).
 *  - Revocation is immediate in Postgres and propagates through the cache by
 *    explicit eviction, with a hard 30s staleness ceiling as a backstop.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  private static readonly CACHE_PREFIX = 'auth:at:';
  private static readonly CACHE_TTL_SECONDS = 30;
  private static readonly REFRESH_GRACE_MS = 10_000;

  constructor(
    @InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>,
    private readonly config: ConfigService<EnvConfig, true>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ── Issue ─────────────────────────────────────────────────────────────────

  async create(user: User, meta: SessionMeta = {}): Promise<IssuedTokens> {
    await this.enforceSessionCap(user.id);

    const tokens = this.mint(new Date());
    await this.sessions.insert({
      userId: user.id,
      accessTokenHash: hashToken(tokens.accessToken),
      accessExpiresAt: tokens.accessExpiresAt,
      refreshTokenHash: hashToken(tokens.refreshToken),
      refreshExpiresAt: tokens.refreshExpiresAt,
      ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
    });
    return tokens;
  }

  // ── Authenticate (hot path) ───────────────────────────────────────────────

  async authenticate(rawAccessToken: string): Promise<CurrentUserData | null> {
    const hash = hashToken(rawAccessToken);
    const cacheKey = SessionService.CACHE_PREFIX + hash;

    const cached = await this.cacheGet(cacheKey);
    if (cached && cached.exp > Date.now()) {
      const { exp: _exp, ...principal } = cached;
      return principal;
    }

    const session = await this.sessions
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.user', 'u')
      .where('s.accessTokenHash = :hash', { hash })
      .andWhere('s.revokedAt IS NULL')
      .andWhere('s.accessExpiresAt > now()')
      .andWhere('u.isActive = true')
      .getOne();

    if (!session) return null;

    const principal: CurrentUserData = {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      sessionId: session.id,
    };

    const ttl = Math.min(
      SessionService.CACHE_TTL_SECONDS,
      Math.floor((session.accessExpiresAt.getTime() - Date.now()) / 1000),
    );
    if (ttl > 0) {
      await this.cacheSet(cacheKey, { ...principal, exp: session.accessExpiresAt.getTime() }, ttl);
    }
    return principal;
  }

  // ── Rotate ────────────────────────────────────────────────────────────────

  async rotate(rawRefreshToken: string): Promise<RotationResult> {
    const hash = hashToken(rawRefreshToken);
    const now = new Date();

    const current = await this.sessions.findOne({
      where: { refreshTokenHash: hash },
      relations: { user: true },
    });

    if (current) {
      if (current.revokedAt || current.refreshExpiresAt <= now) {
        throw new UnauthorizedException('Session expired');
      }
      if (!current.user.isActive) {
        await this.revokeByIds([current.id]);
        throw new UnauthorizedException('Account disabled');
      }

      const next = this.mint(now, current.createdAt);

      // Compare-and-swap: only one of N concurrent refreshes can win.
      const swap = await this.sessions.update(
        { id: current.id, refreshTokenHash: hash, revokedAt: IsNull() },
        {
          accessTokenHash: hashToken(next.accessToken),
          accessExpiresAt: next.accessExpiresAt,
          refreshTokenHash: hashToken(next.refreshToken),
          refreshExpiresAt: next.refreshExpiresAt,
          previousRefreshTokenHash: hash,
          rotatedAt: now,
        },
      );

      if (swap.affected === 1) {
        await this.cacheDel([current.accessTokenHash]);
        return { user: current.user, sessionId: current.id, tokens: next };
      }
      // Lost the race: fall through and treat as a replay of a rotated token.
    }

    const rotated = await this.sessions.findOne({
      where: { previousRefreshTokenHash: hash },
      relations: { user: true },
    });

    if (rotated && !rotated.revokedAt && rotated.user.isActive) {
      const age = rotated.rotatedAt ? now.getTime() - rotated.rotatedAt.getTime() : Infinity;
      if (age <= SessionService.REFRESH_GRACE_MS) {
        return { user: rotated.user, sessionId: rotated.id, tokens: null };
      }
      this.logger.warn({
        message: 'Refresh token reuse detected; revoking session',
        sessionId: rotated.id,
        userId: rotated.userId,
      });
      await this.revokeByIds([rotated.id]);
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  /** Idempotent: safe to call with expired, unknown, or missing tokens. */
  async revokeByTokens(rawAccessToken?: string, rawRefreshToken?: string): Promise<void> {
    const hashes = [rawAccessToken, rawRefreshToken].filter(Boolean).map((t) => hashToken(t!));
    if (!hashes.length) return;

    const rows = await this.sessions.find({
      where: [{ accessTokenHash: In(hashes) }, { refreshTokenHash: In(hashes) }],
      select: { id: true },
    });
    await this.revokeByIds(rows.map((r) => r.id));
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    const rows = await this.sessions.find({
      where: { userId, revokedAt: IsNull(), ...(exceptSessionId ? { id: Not(exceptSessionId) } : {}) },
      select: { id: true },
    });
    await this.revokeByIds(rows.map((r) => r.id));
  }

  async revokeByIds(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const rows = await this.sessions.find({ where: { id: In(ids) }, select: { id: true, accessTokenHash: true } });
    await this.sessions.update({ id: In(ids), revokedAt: IsNull() }, { revokedAt: new Date() });
    await this.cacheDel(rows.map((r) => r.accessTokenHash));
  }

  /** Housekeeping for the maintenance job. */
  async purgeDead(): Promise<number> {
    const now = Date.now();
    const res = await this.sessions.delete([
      { refreshExpiresAt: LessThan(new Date(now - 24 * 3600 * 1000)) },
      { revokedAt: LessThan(new Date(now - 7 * 24 * 3600 * 1000)) },
    ]);
    return res.affected ?? 0;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private mint(now: Date, sessionCreatedAt: Date = now): IssuedTokens {
    const accessMs = this.config.get('accessTokenMs', { infer: true });
    const refreshMs = this.config.get('refreshTokenMs', { infer: true });
    const maxMs = this.config.get('sessionMaxLifetimeMs', { infer: true });

    const hardStop = sessionCreatedAt.getTime() + maxMs;
    return {
      accessToken: generateToken(),
      refreshToken: generateToken(),
      accessExpiresAt: new Date(now.getTime() + accessMs),
      refreshExpiresAt: new Date(Math.min(now.getTime() + refreshMs, hardStop)),
    };
  }

  private async enforceSessionCap(userId: string): Promise<void> {
    const max = this.config.get('MAX_SESSIONS_PER_USER', { infer: true });
    const active = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'ASC' },
      select: { id: true, refreshExpiresAt: true },
    });
    const live = active.filter((s) => s.refreshExpiresAt > new Date());
    if (live.length >= max) {
      await this.revokeByIds(live.slice(0, live.length - max + 1).map((s) => s.id));
    }
  }

  // Cache failures must never take authentication down: fall back to Postgres.
  private async cacheGet(key: string): Promise<CachedPrincipal | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as CachedPrincipal) : null;
    } catch (err) {
      this.logger.warn(`Session cache read failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async cacheSet(key: string, value: CachedPrincipal, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Session cache write failed: ${(err as Error).message}`);
    }
  }

  private async cacheDel(accessHashes: string[]): Promise<void> {
    if (!accessHashes.length) return;
    try {
      await this.redis.del(...accessHashes.map((h) => SessionService.CACHE_PREFIX + h));
    } catch (err) {
      this.logger.warn(`Session cache eviction failed: ${(err as Error).message}`);
    }
  }
}

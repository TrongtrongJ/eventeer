import { Injectable, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import bcrypt from "@node-rs/bcrypt";
import crypto from "crypto";
import { User } from "../entities/user.entity";
import { RefreshToken } from "./refresh-token.entity";
import { EnvConfig } from "../env.validation";
import { ConfigService } from "@nestjs/config";

const BCRYPT_ROUNDS = 12;
const MAX_SESSIONS = 5; // max concurrent devices per user

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        @InjectRepository(RefreshToken)
        private readonly rtRepo: Repository<RefreshToken>,

        private readonly configService: ConfigService<EnvConfig, true>,
    ) {}

    // ── User CRUD ─────────────────────────────────────────────────────────────

    async create(email: string, password: string): Promise<User> {
        const normalizedEmail = email.toLowerCase().trim();

        const existing = await this.userRepo.findOne({
            where: { email: normalizedEmail },
        });
        if (existing) {
            throw new ConflictException("An account with that email already exists");
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const user = this.userRepo.create({ email: normalizedEmail, passwordHash });
        return this.userRepo.save(user);
    }

    async findById(id: string): Promise<User | null> {
        return this.userRepo.findOne({ where: { id } });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepo.findOne({
            where: { email: email.toLowerCase().trim() },
        });
    }

    async validatePassword(user: User, password: string): Promise<boolean> {
        if (user.passwordHash == null) return false;
        const result = await bcrypt.compare(password, user.passwordHash)
        console.log({
          password,
          passwordHash: user.passwordHash,
          result
        })
        return result;
    }

    // ── Refresh token management ──────────────────────────────────────────────

    async addRefreshToken(userId: string, rawToken: string): Promise<void> {
        // Prune expired rows for this user
        await this.rtRepo.delete({ userId, expiresAt: LessThan(new Date()) });

        // Enforce session cap — remove oldest entries if over limit
        const existing = await this.rtRepo.find({
            where: { userId },
            order: { createdAt: "ASC" },
        });
        if (existing.length >= MAX_SESSIONS) {
            const toDelete = existing.slice(0, existing.length - MAX_SESSIONS + 1);
            await this.rtRepo.remove(toDelete);
        }

        const sha256Token = crypto.createHash("sha256").update(rawToken).digest("hex");

        const tokenHash = await bcrypt.hash(sha256Token, 12);

        // Mirror the 7-day JWT expiry so we can prune without parsing tokens
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const rt = this.rtRepo.create({ userId, tokenHash, expiresAt });
        await this.rtRepo.save(rt);
    }

    /**
     * Finds and returns the matching RefreshToken row, or null.
     * Returning the row lets the caller delete it by ID (avoids a second scan).
     */
    async validateRefreshToken(userId: string, rawToken: string): Promise<RefreshToken | null> {
        const active = await this.rtRepo
            .createQueryBuilder("rt")
            .where("rt.user_id = :userId", { userId })
            .andWhere("rt.expires_at > NOW()")
            .getMany();
        const sha256Token = crypto.createHash("sha256").update(rawToken).digest("hex");

        for (const rt of active) {
            const match = await bcrypt.compare(sha256Token, rt.tokenHash);
            if (match) return rt;
        }
        return null;
    }

    async removeRefreshTokenById(rtId: string): Promise<void> {
        await this.rtRepo.delete({ id: rtId });
    }

    async clearAllRefreshTokens(userId: string): Promise<void> {
        await this.rtRepo.delete({ userId });
    }
}

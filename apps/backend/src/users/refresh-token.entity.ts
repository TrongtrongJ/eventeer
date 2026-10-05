import { Entity, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { User } from "../entities/user.entity";
import { BaseEntity } from "../common/base-entity/base-entity";

@Entity("refresh_tokens")
export class RefreshToken extends BaseEntity {
    /** bcrypt hash of the raw refresh token JWT */
    @Column({ type: "varchar", name: "token_hash" })
    tokenHash: string;

    @Column({ type: "timestamptz", name: "expires_at" })
    expiresAt: Date;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @Index()
    @ManyToOne(() => User, user => user.refreshTokens, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    @Column({ name: "user_id" })
    userId: string;
}

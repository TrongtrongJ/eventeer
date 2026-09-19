import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, ExtractJwt } from "passport-jwt";
import { Request } from "express";
import { AUTH_COOKIE } from "@packages/shared-schemas";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "../../env.validation";

interface JwtPayload {
    sub: string;
    email: string;
}

function extractRefreshFromCookie(req: Request): string | null {
    return req?.cookies?.[AUTH_COOKIE.REFRESH] ?? null;
}

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
    constructor(configService: ConfigService<EnvConfig, true>) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshFromCookie]),
            secretOrKey: configService.get("REFRESH_TOKEN_SECRET"),
            ignoreExpiration: false,
            passReqToCallback: true,
        });
    }

    validate(req: Request, payload: JwtPayload) {
        const rawRefreshToken = req.cookies?.[AUTH_COOKIE.REFRESH];
        return { ...payload, refreshToken: rawRefreshToken };
    }
}

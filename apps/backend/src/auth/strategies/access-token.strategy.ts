import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { AUTH_COOKIE, JwtUserData } from "@packages/shared-schemas";
import { Strategy, ExtractJwt } from "passport-jwt";
import { Request } from "express";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "../../env.validation";
import { UsersService } from "../../users/user.service";

interface JwtPayload {
    sub: string;
    email: string;
    iat: number;
    exp: number;
}

function extractFromCookie(req: Request): string | null {
    return req?.cookies?.[AUTH_COOKIE.ACCESS] ?? null;
}

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, "jwt-access") {
    constructor(
        configService: ConfigService<EnvConfig, true>,
        private readonly usersService: UsersService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([extractFromCookie]),
            secretOrKey: configService.get("ACCESS_TOKEN_SECRET"),
            ignoreExpiration: false,
            passReqToCallback: false,
        });
    }

    async validate(payload: JwtPayload): Promise<JwtUserData> {
        if (!payload?.sub) throw new UnauthorizedException();

        return { sub: payload.sub, email: payload.email };
    }
}

import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EnvConfig } from "../env.validation";
import { RefreshToken } from "../users/refresh-token.entity";
import { User } from "../entities/user.entity";
import { Booking } from "../entities/booking.entity";
import { Coupon } from "../entities/coupon.entity";
import { Ticket } from "../entities/ticket.entity";
import { Session } from "inspector/promises";
import { Role } from "../entities/role.entity";

export function registerTypeORMWithConfig() {
    return TypeOrmModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (configService: ConfigService<EnvConfig, true>) => ({
            type: "postgres",
            host: configService.get("DB_HOST"),
            port: configService.get("DB_PORT"),
            username: configService.get("DB_USERNAME"),
            password: configService.get("DB_PASSWORD"),
            database: configService.get("DB_NAME", 'event_management'),
            entities: [Event, Booking, Coupon, Ticket, User, Session, Role, RefreshToken],
            synchronize: !configService.get("isProd"),
            logging: configService.get("isDev"),
            statement_timeout: 10000,
            ssl: configService.get("DB_SSL") ? { rejectUnauthorized: false } : false,
        }),
    });
}

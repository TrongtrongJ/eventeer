import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersService } from "./user.service";
import { User } from "../entities/user.entity";
import { RefreshToken } from "./refresh-token.entity";
import { CacheModule } from "@nestjs/cache-manager";

@Module({
    imports: [TypeOrmModule.forFeature([User, RefreshToken]), CacheModule.register()],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule {}

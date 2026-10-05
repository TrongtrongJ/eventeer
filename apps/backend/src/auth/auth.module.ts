import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { OAuthController } from './oauth.controller';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { SessionService } from './session.service';
import { AuthenticationGuard } from './guards/authentication.guard';
import { OriginGuard } from './guards/origin.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([User, AuthSession]), EmailModule],
  controllers: [AuthController, OAuthController],
  providers: [AuthService, OAuthService, SessionService, AuthenticationGuard, OriginGuard, RolesGuard],
  exports: [SessionService, AuthenticationGuard, OriginGuard, RolesGuard],
})
export class AuthModule {}

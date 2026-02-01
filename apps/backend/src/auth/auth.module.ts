import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import {HttpModule} from '@nestjs/axios'
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { Role } from '../entities/role.entity';
import { EmailModule } from '../email/email.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Event } from '../entities/event.entity';
import { Booking } from '../entities/booking.entity';

@Global()
@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([User, Session, Role, Event, Booking]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_ACCESS_SECRET');
        
        if (!secret) {
          console.warn('⚠️  JWT_ACCESS_SECRET not set, using fallback (NOT FOR PRODUCTION)');
        }
        
        return {
          secret: secret || 'fallback-secret-key-change-in-production',
          signOptions: {
            expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES') || '15m',
          },
        };
      },
    }),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OAuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    OAuthService,
    JwtAuthGuard,
    RolesGuard,
    JwtModule, // Export JwtModule
    PassportModule, // Export PassportModule
  ],
})
export class AuthModule {}
import { User } from '../entities/user.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { Event } from '../entities/event.entity';
import { Booking } from '../entities/booking.entity';
import { Ticket } from '../entities/ticket.entity';
import { Coupon } from '../entities/coupon.entity';
import { RefreshToken } from '../users/refresh-token.entity';
import { Session } from '../entities/session.entity';

export const ENTITIES = [User, AuthSession, Event, Booking, Ticket, Coupon, RefreshToken, Session];

import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { BookingsService } from '../bookings/bookings.service';
import { SessionService } from '../auth/session.service';
import { EXPIRE_HOLDS_JOB, PURGE_SESSIONS_JOB } from './maintenance.scheduler';

@Processor('maintenance')
export class MaintenanceProcessor {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly bookings: BookingsService,
    private readonly sessions: SessionService,
  ) {}

  /** Releases seats held by checkouts that never paid, so abandoned carts can't lock out inventory. */
  @Process(EXPIRE_HOLDS_JOB)
  async expireHolds() {
    const expired = await this.bookings.expireStaleHolds();
    if (expired > 0) this.logger.log(`Expired ${expired} stale booking hold(s)`);
  }

  @Process(PURGE_SESSIONS_JOB)
  async purgeSessions() {
    const purged = await this.sessions.purgeDead();
    if (purged > 0) this.logger.log(`Purged ${purged} dead auth session(s)`);
  }
}

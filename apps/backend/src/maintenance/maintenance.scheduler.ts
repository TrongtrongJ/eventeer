import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

export const EXPIRE_HOLDS_JOB = 'expire-holds';
export const PURGE_SESSIONS_JOB = 'purge-sessions';

/**
 * Registers repeatable jobs. Bull derives the repeat key from name + options + jobId,
 * so N replicas registering the same schedule still produce ONE recurring job.
 */
@Injectable()
export class MaintenanceScheduler implements OnModuleInit {
  constructor(@InjectQueue('maintenance') private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.add(EXPIRE_HOLDS_JOB, {}, { repeat: { every: 60_000 }, jobId: EXPIRE_HOLDS_JOB, removeOnComplete: true });
    await this.queue.add(PURGE_SESSIONS_JOB, {}, { repeat: { every: 6 * 3600_000 }, jobId: PURGE_SESSIONS_JOB, removeOnComplete: true });
  }
}

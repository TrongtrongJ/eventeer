import { Processor, Process } from "@nestjs/bull";
import type { Job } from "bull";
import { Logger } from "@nestjs/common";
import { CircuitOpenError } from "@nestjs/resilience";
import { EmailService, EmailJob } from "./email.service";

/** Thrown for a mail whose usefulness has passed; the job is failed for good, not retried. */
export class EmailExpiredError extends Error {
    constructor(deliverBy: number) {
        super(`Email expired before it could be delivered (deliverBy ${new Date(deliverBy).toISOString()})`);
        this.name = "EmailExpiredError";
    }
}

/**
 * Bull counts every failed run as an attempt: `moveToFailed` adds one and persists the job's in-memory
 * `attemptsMade`. A circuit-open rejection never reached the SMTP server, so it is not an attempt:
 * subtracting one here makes that increment net to zero, and the job waits out the outage instead of
 * running out of attempts in a few seconds.
 */
export function refundAttempt(job: Job): void {
    job.attemptsMade -= 1;
}

@Processor("email")
export class EmailProcessor {
    private readonly logger = new Logger(EmailProcessor.name);

    constructor(private readonly emailService: EmailService) {}

    @Process("booking-confirmation")
    handleBookingConfirmation(job: Job<EmailJob>) {
        return this.deliver(job, "booking confirmation");
    }

    @Process("email-verification")
    handleEmailVerification(job: Job<EmailJob>) {
        return this.deliver(job, "email verification");
    }

    @Process("password-reset")
    handlePasswordReset(job: Job<EmailJob>) {
        return this.deliver(job, "password reset");
    }

    private async deliver(job: Job<EmailJob>, kind: string): Promise<void> {
        const log = { jobId: job.id, correlationId: job.data.correlationId, kind, attempt: job.attemptsMade + 1 };

        const { deliverBy } = job.data;
        if (deliverBy !== undefined && Date.now() > deliverBy) {
            void job.discard(); // fail for good: sending it now would be wrong, and retrying cannot fix that
            this.logger.warn({ message: "Dropping expired email", ...log });
            throw new EmailExpiredError(deliverBy);
        }

        try {
            await this.emailService.sendEmail(job.data);
        } catch (error) {
            if (error instanceof CircuitOpenError) {
                refundAttempt(job);
                this.logger.warn({
                    message: "SMTP circuit is open: delaying email without using an attempt",
                    ...log,
                    retryAfterMs: error.retryAfterMs,
                });
            } else {
                this.logger.error({ message: `Failed to send ${kind} email`, ...log, error: (error as Error).message });
            }
            throw error; // Bull applies the backoff strategy (or fails the job if the error is permanent)
        }
    }
}

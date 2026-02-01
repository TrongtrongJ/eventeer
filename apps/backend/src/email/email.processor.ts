import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { EmailService, EmailJob } from './email.service';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  @Process('booking-confirmation')
  async handleBookingConfirmation(job: Job<EmailJob>) {
    this.logger.log({
      message: 'Processing booking confirmation email',
      jobId: job.id,
      correlationId: job.data.correlationId,
      to: job.data.to,
    });

    try {
      await this.emailService.sendEmail(job.data);

      this.logger.log({
        message: 'Booking confirmation email processed',
        jobId: job.id,
        correlationId: job.data.correlationId,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to process booking confirmation email',
        jobId: job.id,
        correlationId: job.data.correlationId,
        error: error.message,
        attempt: job.attemptsMade,
      });
      throw error; // Rethrow to trigger retry
    }
  }

  @Process('email-verification')
  async handleEmailVerification(job: Job<EmailJob>) {
    this.logger.log({
      message: 'Processing email verification',
      jobId: job.id,
      correlationId: job.data.correlationId,
      to: job.data.to,
    });

    try {
      await this.emailService.sendEmail(job.data);

      this.logger.log({
        message: 'Email verification sent',
        jobId: job.id,
        correlationId: job.data.correlationId,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to send verification email',
        jobId: job.id,
        correlationId: job.data.correlationId,
        error: error.message,
        attempt: job.attemptsMade,
      });
      throw error;
    }
  }

  @Process('password-reset')
  async handlePasswordReset(job: Job<EmailJob>) {
    this.logger.log({
      message: 'Processing password reset email',
      jobId: job.id,
      correlationId: job.data.correlationId,
      to: job.data.to,
    });

    try {
      await this.emailService.sendEmail(job.data);

      this.logger.log({
        message: 'Password reset email sent',
        jobId: job.id,
        correlationId: job.data.correlationId,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to send password reset email',
        jobId: job.id,
        correlationId: job.data.correlationId,
        error: error.message,
        attempt: job.attemptsMade,
      });
      throw error;
    }
  }
}

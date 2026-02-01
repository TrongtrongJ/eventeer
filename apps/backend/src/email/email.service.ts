import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as nodemailer from 'nodemailer';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  correlationId: string;
}

export interface BookingConfirmationData {
  email: string;
  firstName: string;
  lastName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  quantity: number;
  totalAmount: number;
  bookingId: string;
  qrCodes: Array<{ ticketNumber: string; qrCode: string }>;
}

export interface EmailVerificationData {
  email: string;
  firstName: string;
  token: string;
}

export interface PasswordResetData {
  email: string;
  firstName: string;
  token: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly featureEnabled: boolean;

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly configService: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });

    this.featureEnabled = this.configService.get('FEATURE_EMAIL_ENABLED') === 'true';
  }

  async queueBookingConfirmation(
    data: BookingConfirmationData,
    correlationId: string,
  ): Promise<void> {
    if (!this.featureEnabled) {
      this.logger.warn({
        message: 'Email feature is disabled, skipping email',
        correlationId,
        email: data.email,
      });
      return;
    }

    const html = this.generateBookingConfirmationHtml(data);

    await this.emailQueue.add(
      'booking-confirmation',
      {
        to: data.email,
        subject: `Booking Confirmation - ${data.eventTitle}`,
        html,
        correlationId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log({
      message: 'Booking confirmation email queued',
      correlationId,
      email: data.email,
      bookingId: data.bookingId,
    });
  }

  async sendEmail(emailData: EmailJob): Promise<void> {
    const { to, subject, html, correlationId } = emailData;

    try {
      await this.circuitBreaker.execute(
        'email-service',
        async () => {
          const info = await this.transporter.sendMail({
            from: this.configService.get('EMAIL_FROM'),
            to,
            subject,
            html,
          });

          this.logger.log({
            message: 'Email sent successfully',
            correlationId,
            to,
            messageId: info.messageId,
          });
        },
        async () => {
          // Fallback: Log email content for manual sending
          this.logger.warn({
            message: 'Email circuit breaker open - email not sent',
            correlationId,
            to,
            subject,
          });

          // In production, you might want to store this in a dead letter queue
          // or send to an alternative notification service
        },
      );
    } catch (error) {
      this.logger.error({
        message: 'Failed to send email',
        correlationId,
        to,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private generateBookingConfirmationHtml(data: BookingConfirmationData): string {
    const ticketsList = data.qrCodes
      .map(
        (ticket) => `
        <div style="margin: 10px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
          <p style="margin: 5px 0;"><strong>Ticket #${ticket.ticketNumber}</strong></p>
          <p style="margin: 5px 0; font-size: 12px; word-break: break-all;">QR Code: ${ticket.qrCode}</p>
        </div>
      `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Confirmed!</h1>
          </div>
          <div class="content">
            <p>Dear ${data.firstName} ${data.lastName},</p>
            
            <p>Thank you for your booking! Your tickets for <strong>${
              data.eventTitle
            }</strong> have been confirmed.</p>
            
            <h3>Event Details:</h3>
            <ul>
              <li><strong>Event:</strong> ${data.eventTitle}</li>
              <li><strong>Date:</strong> ${new Date(data.eventDate).toLocaleString()}</li>
              <li><strong>Location:</strong> ${data.eventLocation}</li>
              <li><strong>Quantity:</strong> ${data.quantity} ticket(s)</li>
              <li><strong>Total Amount:</strong> $${data.totalAmount.toFixed(2)}</li>
            </ul>

            <h3>Your Tickets:</h3>
            ${ticketsList}

            <p style="margin-top: 20px;">Please present your QR code at the event entrance. Save this email or take a screenshot of your tickets.</p>

            <p><strong>Booking ID:</strong> ${data.bookingId}</p>

            <p>If you have any questions, please don't hesitate to contact us.</p>

            <p>See you at the event!</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
            <p>&copy; 2025 Event Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async queueEmailVerification(data: EmailVerificationData, correlationId: string): Promise<void> {
    if (!this.featureEnabled) {
      this.logger.warn({
        message: 'Email feature is disabled, skipping verification email',
        correlationId,
        email: data.email,
      });
      return;
    }

    const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email?token=${data.token}`;
    const html = this.generateEmailVerificationHtml(data, verificationUrl);

    await this.emailQueue.add(
      'email-verification',
      {
        to: data.email,
        subject: 'Verify Your Email Address',
        html,
        correlationId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log({
      message: 'Email verification queued',
      correlationId,
      email: data.email,
    });
  }

  async queuePasswordReset(data: PasswordResetData, correlationId: string): Promise<void> {
    if (!this.featureEnabled) {
      this.logger.warn({
        message: 'Email feature is disabled, skipping password reset email',
        correlationId,
        email: data.email,
      });
      return;
    }

    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${data.token}`;
    const html = this.generatePasswordResetHtml(data, resetUrl);

    await this.emailQueue.add(
      'password-reset',
      {
        to: data.email,
        subject: 'Reset Your Password',
        html,
        correlationId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log({
      message: 'Password reset email queued',
      correlationId,
      email: data.email,
    });
  }

  private generateEmailVerificationHtml(
    data: EmailVerificationData,
    verificationUrl: string,
  ): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
          <div class="header">
            <h1>Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Hi ${data.firstName},</p>
            
            <p>Thank you for registering with Event Management! To complete your registration and activate your account, please verify your email address.</p>
            
            <p style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </p>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 3px;">
              ${verificationUrl}
            </p>
            
            <p><strong>This link will expire in 24 hours.</strong></p>
            
            <p>If you didn't create an account with us, please ignore this email.</p>
            
            <p>Best regards,<br>The Event Management Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
            <p>&copy; 2025 Event Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetHtml(data: PasswordResetData, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi ${data.firstName},</p>
            
            <p>We received a request to reset your password for your Event Management account.</p>
            
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 3px;">
              ${resetUrl}
            </p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>This link will expire in 1 hour</li>
                <li>If you didn't request this, please ignore this email</li>
                <li>Your password will remain unchanged until you create a new one</li>
              </ul>
            </div>
            
            <p>If you continue to have problems, please contact our support team.</p>
            
            <p>Best regards,<br>The Event Management Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
            <p>&copy; 2025 Event Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
import * as crypto from 'crypto';

interface MockPaymentIntent {
  id: string;
  client_secret: string;
  status: 'requires_payment_method' | 'succeeded' | 'processing' | 'requires_confirmation';
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  created: number;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe | null;
  private readonly featureEnabled: boolean;
  private readonly mockPayments: Map<string, MockPaymentIntent> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    this.featureEnabled = this.configService.get('FEATURE_PAYMENT_ENABLED') === 'true';

    if (this.featureEnabled && this.configService.get('STRIPE_SECRET_KEY')) {
      this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY') || '', {
        apiVersion: '2023-10-16',
      });
      this.logger.log('Stripe payment service initialized');
    } else {
      this.stripe = null;
      this.logger.warn('Mock payment service initialized (Stripe disabled or not configured)');
    }
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
    correlationId: string,
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    this.logger.log({
      message: 'Creating payment intent',
      correlationId,
      amount,
      currency,
      bookingId: metadata.bookingId,
      mockMode: !this.stripe,
    });

    // Use mock payment if Stripe is not configured
    if (!this.stripe) {
      return this.createMockPaymentIntent(amount, currency, metadata, correlationId);
    }

    // Real Stripe payment
    try {
      const result = await this.circuitBreaker.execute(
        'stripe-payment',
        async () => {
          const paymentIntent = await this.stripe!.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: currency.toLowerCase(),
            metadata: {
              ...metadata,
              correlationId,
            },
            automatic_payment_methods: {
              enabled: true,
            },
          });

          return {
            clientSecret: paymentIntent.client_secret!,
            paymentIntentId: paymentIntent.id,
          };
        },
        async () => {
          // Fallback to mock if circuit breaker opens
          this.logger.warn({
            message: 'Stripe circuit breaker open, falling back to mock payment',
            correlationId,
          });
          return this.createMockPaymentIntent(amount, currency, metadata, correlationId);
        },
      );

      this.logger.log({
        message: 'Payment intent created',
        correlationId,
        paymentIntentId: result.paymentIntentId,
      });

      return result;
    } catch (error) {
      this.logger.error({
        message: 'Failed to create payment intent',
        correlationId,
        error: error.message,
        stack: error.stack,
      });
      throw new BadRequestException('Failed to initialize payment');
    }
  }

  async confirmPayment(paymentIntentId: string, correlationId: string): Promise<boolean> {
    this.logger.log({
      message: 'Confirming payment',
      correlationId,
      paymentIntentId,
      mockMode: !this.stripe,
    });

    // Handle mock payment
    if (paymentIntentId.startsWith('mock_pi_')) {
      return this.confirmMockPayment(paymentIntentId, correlationId);
    }

    // Handle real Stripe payment
    if (!this.stripe) {
      this.logger.warn({
        message: 'Stripe not configured but received real payment intent ID',
        correlationId,
        paymentIntentId,
      });
      return false;
    }

    try {
      const paymentIntent = await this.circuitBreaker.execute(
        'stripe-payment',
        async () => {
          return await this.stripe!.paymentIntents.retrieve(paymentIntentId);
        },
        async () => {
          // Fallback: Check if it's a mock payment
          if (this.mockPayments.has(paymentIntentId)) {
            return this.mockPayments.get(paymentIntentId) as any;
          }
          throw new Error('Circuit breaker open and payment not found');
        },
      );

      const isSucceeded = paymentIntent.status === 'succeeded';

      this.logger.log({
        message: 'Payment confirmation checked',
        correlationId,
        paymentIntentId,
        status: paymentIntent.status,
        isSucceeded,
      });

      return isSucceeded;
    } catch (error) {
      this.logger.error({
        message: 'Failed to confirm payment',
        correlationId,
        paymentIntentId,
        error: error.message,
      });
      return false;
    }
  }

  async refundPayment(
    paymentIntentId: string,
    amount: number,
    correlationId: string,
  ): Promise<boolean> {
    this.logger.log({
      message: 'Processing refund',
      correlationId,
      paymentIntentId,
      amount,
      mockMode: !this.stripe,
    });

    // Handle mock refund
    if (paymentIntentId.startsWith('mock_pi_')) {
      return this.refundMockPayment(paymentIntentId, amount, correlationId);
    }

    // Handle real Stripe refund
    if (!this.stripe) {
      this.logger.warn({
        message: 'Stripe not configured but received refund request',
        correlationId,
        paymentIntentId,
      });
      return false;
    }

    try {
      await this.circuitBreaker.execute(
        'stripe-payment',
        async () => {
          await this.stripe!.refunds.create({
            payment_intent: paymentIntentId,
            amount: Math.round(amount * 100),
          });
        },
        async () => {
          this.logger.warn({
            message: 'Refund fallback: Manual intervention required',
            correlationId,
            paymentIntentId,
          });
        },
      );

      this.logger.log({
        message: 'Payment refunded',
        correlationId,
        paymentIntentId,
        amount,
      });

      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to refund payment',
        correlationId,
        paymentIntentId,
        error: error.message,
      });
      return false;
    }
  }

  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    if (!this.stripe) {
      this.logger.warn('Received webhook but Stripe is not configured');
      return;
    }

    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.warn('Stripe webhook secret not configured');
      return;
    }

    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      this.logger.log({
        message: 'Webhook event received',
        type: event.type,
        eventId: event.id,
      });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        default:
          this.logger.log({
            message: 'Unhandled webhook event type',
            type: event.type,
          });
      }
    } catch (error) {
      this.logger.error({
        message: 'Webhook processing failed',
        error: error.message,
      });
      throw error;
    }
  }

  // Mock Payment Methods
  private createMockPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
    correlationId: string,
  ): { clientSecret: string; paymentIntentId: string } {
    const paymentIntentId = `mock_pi_${crypto.randomBytes(16).toString('hex')}`;
    const clientSecret = `mock_secret_${crypto.randomBytes(16).toString('hex')}`;

    const mockPayment: MockPaymentIntent = {
      id: paymentIntentId,
      client_secret: clientSecret,
      status: 'requires_payment_method',
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      metadata: {
        ...metadata,
        correlationId,
      },
      created: Date.now(),
    };

    this.mockPayments.set(paymentIntentId, mockPayment);

    this.logger.log({
      message: 'Mock payment intent created',
      correlationId,
      paymentIntentId,
      amount,
      currency,
    });

    // Auto-succeed mock payment after 2 seconds (simulating payment processing)
    setTimeout(() => {
      const payment = this.mockPayments.get(paymentIntentId);
      if (payment) {
        payment.status = 'succeeded';
        this.mockPayments.set(paymentIntentId, payment);
        this.logger.log({
          message: 'Mock payment auto-succeeded',
          correlationId,
          paymentIntentId,
        });
      }
    }, 2000);

    return {
      clientSecret,
      paymentIntentId,
    };
  }

  private confirmMockPayment(paymentIntentId: string, correlationId: string): boolean {
    const payment = this.mockPayments.get(paymentIntentId);

    if (!payment) {
      this.logger.warn({
        message: 'Mock payment not found',
        correlationId,
        paymentIntentId,
      });
      return false;
    }

    // Mock payments are automatically succeeded after creation
    const isSucceeded = payment.status === 'succeeded';

    this.logger.log({
      message: 'Mock payment confirmed',
      correlationId,
      paymentIntentId,
      status: payment.status,
      isSucceeded,
    });

    return isSucceeded;
  }

  private refundMockPayment(
    paymentIntentId: string,
    amount: number,
    correlationId: string,
  ): boolean {
    const payment = this.mockPayments.get(paymentIntentId);

    if (!payment) {
      this.logger.warn({
        message: 'Mock payment not found for refund',
        correlationId,
        paymentIntentId,
      });
      return false;
    }

    // Mock refund always succeeds
    this.logger.log({
      message: 'Mock payment refunded',
      correlationId,
      paymentIntentId,
      amount,
    });

    // Remove from mock payments to simulate refund
    this.mockPayments.delete(paymentIntentId);

    return true;
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.log({
      message: 'Payment succeeded',
      paymentIntentId: paymentIntent.id,
      bookingId: paymentIntent.metadata.bookingId,
    });
    // Additional processing handled by BookingsService
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.error({
      message: 'Payment failed',
      paymentIntentId: paymentIntent.id,
      bookingId: paymentIntent.metadata.bookingId,
    });
    // Additional processing handled by BookingsService
  }

  // Utility method to check if using mock payments
  isMockMode(): boolean {
    return !this.stripe;
  }

  // Utility method for testing - manually succeed a mock payment
  async succeedMockPayment(paymentIntentId: string): Promise<void> {
    if (!paymentIntentId.startsWith('mock_pi_')) {
      throw new Error('Not a mock payment intent');
    }

    const payment = this.mockPayments.get(paymentIntentId);
    if (payment) {
      payment.status = 'succeeded';
      this.mockPayments.set(paymentIntentId, payment);
      this.logger.log({
        message: 'Mock payment manually succeeded',
        paymentIntentId,
      });
    }
  }
}

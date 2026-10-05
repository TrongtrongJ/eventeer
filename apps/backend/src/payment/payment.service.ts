import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
import type { EnvConfig } from '../env.validation';

export interface CreatedIntent {
  id: string;
  clientSecret: string;
}

export type PaymentStatus = 'succeeded' | 'processing' | 'pending' | 'canceled';

/** Provider events the booking domain cares about, decoupled from Stripe's types. */
export type PaymentEvent =
  | { type: 'succeeded'; paymentIntentId: string }
  | { type: 'canceled'; paymentIntentId: string };

const MOCK_PREFIX = 'pi_mock_';

/**
 * Stripe is the only provider. Outside production, when no key is configured,
 * a deterministic MOCK mode lets the full booking flow run locally:
 *  - intent ids are derived from the booking (`pi_mock_<bookingId>`), so mock
 *    state is stateless and survives restarts and multiple replicas;
 *  - env validation forbids mock mode in production, and there is NO runtime
 *    fallback to mock when Stripe is down (that would hand out free tickets).
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe | null;
  private readonly webhookSecret?: string;

  constructor(
    config: ConfigService<EnvConfig, true>,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {
    const key = config.get('STRIPE_SECRET_KEY', { infer: true });
    const enabled = config.get('FEATURE_PAYMENT_ENABLED', { infer: true });
    this.webhookSecret = config.get('STRIPE_WEBHOOK_SECRET', { infer: true });

    this.stripe = enabled && key ? new Stripe(key) : null;
    if (!this.stripe) {
      this.logger.warn('Stripe is not configured: using MOCK payments (non-production only)');
    }
  }

  get isMock(): boolean {
    return this.stripe === null;
  }

  async createPaymentIntent(params: {
    amountCents: number;
    currency: string;
    bookingId: string;
    correlationId: string;
  }): Promise<CreatedIntent> {
    const { amountCents, currency, bookingId, correlationId } = params;

    if (!this.stripe) {
      const id = `${MOCK_PREFIX}${bookingId}`;
      return { id, clientSecret: `${id}_secret_mock` };
    }

    const intent = await this.call('stripe-create-intent', () =>
      this.stripe!.paymentIntents.create(
        {
          amount: amountCents,
          currency: currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          metadata: { bookingId, correlationId },
        },
        // Retrying the same booking can never create a second charge.
        { idempotencyKey: `intent-${bookingId}` },
      ),
    );

    if (!intent.client_secret) throw new ServiceUnavailableException('Payment provider returned no client secret');
    return { id: intent.id, clientSecret: intent.client_secret };
  }

  /** Source of truth for "did the customer actually pay?". Never trust the client. */
  async getPaymentStatus(paymentIntentId: string): Promise<{ status: PaymentStatus; amountCents: number | null }> {
    if (!this.stripe) {
      // Mock: nothing is ever paid "in the background", so a hold that wasn't explicitly
      // confirmed by the user (the demo Pay button) must read as unpaid and be expirable.
      return { status: 'pending', amountCents: null };
    }
    const intent = await this.call('stripe-retrieve-intent', () => this.stripe!.paymentIntents.retrieve(paymentIntentId));
    const status: PaymentStatus =
      intent.status === 'succeeded'
        ? 'succeeded'
        : intent.status === 'processing'
          ? 'processing'
          : intent.status === 'canceled'
            ? 'canceled'
            : 'pending';
    return { status, amountCents: intent.amount };
  }

  /** Stops a released/expired hold from being paid later. Safe to call repeatedly. */
  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    if (!this.stripe) return;
    try {
      await this.call('stripe-cancel-intent', () => this.stripe!.paymentIntents.cancel(paymentIntentId));
    } catch (err) {
      // Already canceled / already succeeded: callers re-check status, so this is non-fatal.
      this.logger.warn(`Could not cancel intent ${paymentIntentId}: ${(err as Error).message}`);
    }
  }

  /** Idempotent. Throws if the refund cannot be issued, so callers never release seats on a failed refund. */
  async refund(paymentIntentId: string): Promise<void> {
    if (!this.stripe) return;
    await this.call('stripe-refund', () =>
      this.stripe!.refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey: `refund-${paymentIntentId}` }),
    );
  }

  /** Verifies the signature against the exact raw bytes and maps to a domain event (or null to ignore). */
  parseWebhook(signature: string | undefined, rawBody: Buffer): PaymentEvent | null {
    if (!this.stripe || !this.webhookSecret) {
      throw new BadRequestException('Webhooks are not enabled');
    }
    if (!signature || !Buffer.isBuffer(rawBody)) {
      throw new BadRequestException('Missing signature or raw body');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        return { type: 'succeeded', paymentIntentId: (event.data.object as Stripe.PaymentIntent).id };
      case 'payment_intent.canceled':
        return { type: 'canceled', paymentIntentId: (event.data.object as Stripe.PaymentIntent).id };
      // payment_intent.payment_failed is deliberately ignored: a declined card leaves the intent
      // retryable, so the hold stays valid until it expires.
      default:
        return null;
    }
  }

  private async call<T>(circuit: string, fn: () => Promise<T>): Promise<T> {
    try {
      // No fallback on purpose: if Stripe is unavailable we fail closed.
      return await this.circuitBreaker.execute(circuit, fn);
    } catch (err) {
      this.logger.error(`${circuit} failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Payment provider is temporarily unavailable');
    }
  }
}

import { Test, TestingModule } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue, Worker, Job } from "bullmq";
import { TicketQueueProducer } from "./ticket-queue.producer";
import { TicketQueueConsumer } from "./ticket-queue.consumer";
import { NotificationQueueProducer } from "./notification-queue.producer";
import { NotificationQueueConsumer } from "./notification-queue.consumer";
import { StripeService } from "../payments/stripe.service";
import { TicketsService } from "../tickets/tickets.service";
import { MailService } from "../mail/mail.service";

// ─── TicketQueueProducer ──────────────────────────────────────────────────────

describe("TicketQueueProducer", () => {
  let producer: TicketQueueProducer;
  let queue: jest.Mocked<Queue>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketQueueProducer,
        {
          provide: getQueueToken("ticket-queue"),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    producer = module.get<TicketQueueProducer>(TicketQueueProducer);
    queue = module.get(getQueueToken("ticket-queue"));
  });

  it("should enqueue a 'purchase-ticket' job with correct payload", async () => {
    await producer.enqueuePurchase({ /* input purchase job data here */ });
    expect(queue.add).toHaveBeenCalledWith(
      "purchase-ticket",
      { /* input expected job data here */ },
      expect.objectContaining({ /* input job options here (e.g. attempts, backoff) */ })
    );
  });

  it("should enqueue a 'cancel-ticket' job with correct payload", async () => {
    await producer.enqueueCancel({ /* input cancel job data here */ });
    expect(queue.add).toHaveBeenCalledWith(
      "cancel-ticket",
      { /* input expected cancel job data here */ },
      expect.any(Object)
    );
  });

  it("should enqueue with retry options (attempts, backoff)", async () => {
    await producer.enqueuePurchase({ /* input purchase data here */ });
    expect(queue.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        attempts: /* input retry attempts count here */,
        backoff: expect.objectContaining({ type: "exponential" }),
      })
    );
  });
});

// ─── TicketQueueConsumer ──────────────────────────────────────────────────────

describe("TicketQueueConsumer", () => {
  let consumer: TicketQueueConsumer;
  let ticketsService: jest.Mocked<TicketsService>;
  let stripeService: jest.Mocked<StripeService>;
  let notificationProducer: jest.Mocked<NotificationQueueProducer>;

  const mockJob = (name: string, data: any): Partial<Job> => ({
    name,
    data,
    id: "job-1",
    attemptsMade: 0,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketQueueConsumer,
        { provide: TicketsService, useValue: { purchase: jest.fn(), cancel: jest.fn() } },
        { provide: StripeService, useValue: { createPaymentIntent: jest.fn(), confirmPayment: jest.fn(), refundPayment: jest.fn() } },
        { provide: NotificationQueueProducer, useValue: { enqueueEmail: jest.fn() } },
      ],
    }).compile();

    consumer = module.get<TicketQueueConsumer>(TicketQueueConsumer);
    ticketsService = module.get(TicketsService);
    stripeService = module.get(StripeService);
    notificationProducer = module.get(NotificationQueueProducer);
  });

  describe("process() - purchase-ticket", () => {
    it("should create payment intent, confirm, purchase ticket, and enqueue notification", async () => {
      stripeService.createPaymentIntent.mockResolvedValue({ /* input payment intent here */ });
      stripeService.confirmPayment.mockResolvedValue({ /* input confirmed payment here */ });
      ticketsService.purchase.mockResolvedValue({ /* input ticket here */ });
      notificationProducer.enqueueEmail.mockResolvedValue(undefined);

      await consumer.process(mockJob("purchase-ticket", { /* input purchase job data here */ }) as Job);

      expect(stripeService.createPaymentIntent).toHaveBeenCalled();
      expect(stripeService.confirmPayment).toHaveBeenCalled();
      expect(ticketsService.purchase).toHaveBeenCalled();
      expect(notificationProducer.enqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({ type: "purchase-confirmation" })
      );
    });

    it("should refund payment and rethrow if ticket creation fails after payment", async () => {
      stripeService.createPaymentIntent.mockResolvedValue({ /* input payment intent here */ });
      stripeService.confirmPayment.mockResolvedValue({ /* input confirmed payment here */ });
      ticketsService.purchase.mockRejectedValue(new Error("DB error"));

      await expect(
        consumer.process(mockJob("purchase-ticket", { /* input purchase job data here */ }) as Job)
      ).rejects.toThrow("DB error");

      expect(stripeService.refundPayment).toHaveBeenCalled(); // compensating transaction
    });

    it("should rethrow if Stripe payment fails (circuit breaker triggers retry)", async () => {
      stripeService.createPaymentIntent.mockRejectedValue(new Error("CircuitBreaker is open"));

      await expect(
        consumer.process(mockJob("purchase-ticket", { /* input purchase data here */ }) as Job)
      ).rejects.toThrow("CircuitBreaker is open");

      expect(ticketsService.purchase).not.toHaveBeenCalled();
    });
  });

  describe("process() - cancel-ticket", () => {
    it("should cancel ticket, refund via Stripe, and enqueue cancellation email", async () => {
      ticketsService.cancel.mockResolvedValue({ /* input cancelled ticket here */ });
      stripeService.refundPayment.mockResolvedValue({ /* input refund result here */ });
      notificationProducer.enqueueEmail.mockResolvedValue(undefined);

      await consumer.process(mockJob("cancel-ticket", { /* input cancel job data here */ }) as Job);

      expect(ticketsService.cancel).toHaveBeenCalled();
      expect(stripeService.refundPayment).toHaveBeenCalled();
      expect(notificationProducer.enqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({ type: "cancellation-confirmation" })
      );
    });

    it("should NOT refund if ticket was already cancelled (idempotency)", async () => {
      ticketsService.cancel.mockRejectedValue(new Error("Already cancelled"));

      await expect(
        consumer.process(mockJob("cancel-ticket", { /* input cancel job data here */ }) as Job)
      ).rejects.toThrow("Already cancelled");

      expect(stripeService.refundPayment).not.toHaveBeenCalled();
    });
  });
});

// ─── NotificationQueueConsumer ────────────────────────────────────────────────

describe("NotificationQueueConsumer", () => {
  let consumer: NotificationQueueConsumer;
  let mailService: jest.Mocked<MailService>;

  const mockJob = (data: any): Partial<Job> => ({ name: "send-email", data, id: "notif-1" });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationQueueConsumer,
        { provide: MailService, useValue: { sendPurchaseConfirmation: jest.fn(), sendCancellationConfirmation: jest.fn(), sendEventReminder: jest.fn() } },
      ],
    }).compile();

    consumer = module.get<NotificationQueueConsumer>(NotificationQueueConsumer);
    mailService = module.get(MailService);
  });

  it("should call sendPurchaseConfirmation for 'purchase-confirmation' type", async () => {
    await consumer.process(mockJob({ type: "purchase-confirmation", /* input email data here */ }) as Job);
    expect(mailService.sendPurchaseConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ /* input expected mail args here */ })
    );
  });

  it("should call sendCancellationConfirmation for 'cancellation-confirmation' type", async () => {
    await consumer.process(mockJob({ type: "cancellation-confirmation", /* input email data here */ }) as Job);
    expect(mailService.sendCancellationConfirmation).toHaveBeenCalled();
  });

  it("should call sendEventReminder for 'event-reminder' type", async () => {
    await consumer.process(mockJob({ type: "event-reminder", /* input reminder data here */ }) as Job);
    expect(mailService.sendEventReminder).toHaveBeenCalled();
  });

  it("should throw for unknown job type", async () => {
    await expect(
      consumer.process(mockJob({ type: "unknown-type" }) as Job)
    ).rejects.toThrow();
  });

  it("should handle mail service failure gracefully and allow BullMQ to retry", async () => {
    mailService.sendPurchaseConfirmation.mockRejectedValue(new Error("SMTP error"));

    await expect(
      consumer.process(mockJob({ type: "purchase-confirmation" }) as Job)
    ).rejects.toThrow("SMTP error");
    // BullMQ will retry based on job options — the consumer should just rethrow
  });
});
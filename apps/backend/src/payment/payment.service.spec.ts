import { Test, TestingModule } from "@nestjs/testing";
import { StripeService } from "./stripe.service";
import { PaymentCircuitBreaker } from "./payment.circuit-breaker";
import { ConfigService } from "@nestjs/config";

// ─── StripeService (unit) ─────────────────────────────────────────────────────

describe("StripeService", () => {
  let service: StripeService;
  let circuitBreaker: jest.Mocked<PaymentCircuitBreaker>;
  let stripeClient: jest.Mocked<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: PaymentCircuitBreaker,
          useValue: { fire: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue("sk_test_mock") },
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
    circuitBreaker = module.get(PaymentCircuitBreaker);
  });

  describe("createPaymentIntent()", () => {
    it("should return a payment intent via circuit breaker", async () => {
      circuitBreaker.fire.mockResolvedValue({ /* input stripe payment intent result here */ });

      const result = await service.createPaymentIntent({ amount: 5000, currency: "usd" });
      expect(circuitBreaker.fire).toHaveBeenCalledWith(expect.any(Function));
      expect(result).toEqual({ /* input expected payment intent here */ });
    });

    it("should throw if circuit breaker is OPEN", async () => {
      circuitBreaker.fire.mockRejectedValue(new Error("CircuitBreaker is open"));

      await expect(
        service.createPaymentIntent({ amount: 5000, currency: "usd" })
      ).rejects.toThrow("CircuitBreaker is open");
    });

    it("should throw on Stripe API failure (4xx/5xx)", async () => {
      circuitBreaker.fire.mockRejectedValue({ type: "StripeCardError", message: "Card declined" });

      await expect(
        service.createPaymentIntent({ amount: 5000, currency: "usd" })
      ).rejects.toMatchObject({ type: "StripeCardError" });
    });
  });

  describe("confirmPayment()", () => {
    it("should confirm payment intent and return confirmed result", async () => {
      circuitBreaker.fire.mockResolvedValue({ /* input confirmed payment intent here */ });

      const result = await service.confirmPayment("pi_123", { /* input payment method here */ });
      expect(result).toEqual({ /* input expected confirm result here */ });
    });

    it("should throw on insufficient funds Stripe error", async () => {
      circuitBreaker.fire.mockRejectedValue({ type: "StripeCardError", code: "insufficient_funds" });

      await expect(service.confirmPayment("pi_123", {})).rejects.toMatchObject({ code: "insufficient_funds" });
    });
  });

  describe("refundPayment()", () => {
    it("should create a refund via circuit breaker", async () => {
      circuitBreaker.fire.mockResolvedValue({ /* input stripe refund result here */ });

      const result = await service.refundPayment("pi_123");
      expect(result).toEqual({ /* input expected refund result here */ });
    });

    it("should throw if payment intent is already refunded", async () => {
      circuitBreaker.fire.mockRejectedValue({ type: "StripeInvalidRequestError", message: "Charge already refunded" });

      await expect(service.refundPayment("pi_already_refunded")).rejects.toMatchObject({
        type: "StripeInvalidRequestError",
      });
    });
  });
});

// ─── PaymentCircuitBreaker ────────────────────────────────────────────────────

describe("PaymentCircuitBreaker", () => {
  let circuitBreaker: PaymentCircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new PaymentCircuitBreaker({ /* input circuit breaker options here */ });
  });

  it("should be in CLOSED state initially", () => {
    expect(circuitBreaker.getState()).toBe("CLOSED");
  });

  it("should OPEN after consecutive failures exceed threshold", async () => {
    const failingFn = jest.fn().mockRejectedValue(new Error("Stripe down"));

    for (let i = 0; i < /* input failure threshold here */; i++) {
      try { await circuitBreaker.fire(failingFn); } catch {}
    }

    expect(circuitBreaker.getState()).toBe("OPEN");
  });

  it("should reject immediately without calling fn when OPEN", async () => {
    // Force open state
    const failingFn = jest.fn().mockRejectedValue(new Error("fail"));
    for (let i = 0; i < /* input failure threshold here */; i++) {
      try { await circuitBreaker.fire(failingFn); } catch {}
    }

    const newFn = jest.fn().mockResolvedValue("success");
    await expect(circuitBreaker.fire(newFn)).rejects.toThrow();
    expect(newFn).not.toHaveBeenCalled();
  });

  it("should transition to HALF-OPEN after reset timeout", async () => {
    jest.useFakeTimers();
    const failingFn = jest.fn().mockRejectedValue(new Error("fail"));
    for (let i = 0; i < /* input failure threshold here */; i++) {
      try { await circuitBreaker.fire(failingFn); } catch {}
    }

    jest.advanceTimersByTime(/* input reset timeout ms here */);
    expect(circuitBreaker.getState()).toBe("HALF-OPEN");
    jest.useRealTimers();
  });

  it("should return to CLOSED if trial request succeeds in HALF-OPEN", async () => {
    jest.useFakeTimers();
    // Force OPEN then wait for HALF-OPEN
    const failingFn = jest.fn().mockRejectedValue(new Error("fail"));
    for (let i = 0; i < /* input failure threshold here */; i++) {
      try { await circuitBreaker.fire(failingFn); } catch {}
    }
    jest.advanceTimersByTime(/* input reset timeout ms here */);

    const successFn = jest.fn().mockResolvedValue("recovered");
    await circuitBreaker.fire(successFn);
    expect(circuitBreaker.getState()).toBe("CLOSED");
    jest.useRealTimers();
  });

  it("should return to OPEN if trial request fails in HALF-OPEN", async () => {
    jest.useFakeTimers();
    const failingFn = jest.fn().mockRejectedValue(new Error("fail"));
    for (let i = 0; i < /* input failure threshold here */; i++) {
      try { await circuitBreaker.fire(failingFn); } catch {}
    }
    jest.advanceTimersByTime(/* input reset timeout ms here */);

    await expect(circuitBreaker.fire(failingFn)).rejects.toThrow();
    expect(circuitBreaker.getState()).toBe("OPEN");
    jest.useRealTimers();
  });
});
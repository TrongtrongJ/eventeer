import { CircuitOpenError } from "@nestjs/resilience";
import { EmailExpiredError, EmailProcessor, refundAttempt } from "./email.processor";

const makeJob = (over: Record<string, unknown> = {}) =>
    ({
        id: "1",
        attemptsMade: 0,
        data: { to: "a@b.com", subject: "s", html: "h", correlationId: "cid" },
        discard: vi.fn(),
        ...over,
    }) as any;

describe("EmailProcessor", () => {
    let emailService: { sendEmail: any };
    let processor: EmailProcessor;

    beforeEach(() => {
        emailService = { sendEmail: vi.fn().mockResolvedValue(undefined) };
        processor = new EmailProcessor(emailService as any);
    });

    it("sends the mail", async () => {
        const job = makeJob();
        await processor.handlePasswordReset(job);
        expect(emailService.sendEmail).toHaveBeenCalledWith(job.data);
    });

    it("an open circuit does not use up an attempt: Bull's +1 on failure nets to zero", async () => {
        emailService.sendEmail.mockRejectedValue(new CircuitOpenError("smtp", 30_000));
        const job = makeJob({ attemptsMade: 2 });

        await expect(processor.handleBookingConfirmation(job)).rejects.toBeInstanceOf(CircuitOpenError);

        // what Bull's moveToFailed does next: attemptsMade++ (then persists it)
        job.attemptsMade += 1;
        expect(job.attemptsMade).toBe(2);
    });

    it("works on the very first attempt too (no clamping at 0)", async () => {
        emailService.sendEmail.mockRejectedValue(new CircuitOpenError("smtp", 30_000));
        const job = makeJob({ attemptsMade: 0 });
        await expect(processor.handleEmailVerification(job)).rejects.toThrow();
        job.attemptsMade += 1;
        expect(job.attemptsMade).toBe(0);
    });

    it("a real send failure DOES use the attempt", async () => {
        emailService.sendEmail.mockRejectedValue(Object.assign(new Error("boom"), { code: "ETIMEDOUT" }));
        const job = makeJob({ attemptsMade: 1 });
        await expect(processor.handlePasswordReset(job)).rejects.toThrow("boom");
        job.attemptsMade += 1;
        expect(job.attemptsMade).toBe(2);
    });

    it("drops a mail whose deliverBy has passed: discarded (no retries) and never sent", async () => {
        const job = makeJob({
            data: { to: "a@b.com", subject: "s", html: "h", correlationId: "c", deliverBy: Date.now() - 1 },
        });
        await expect(processor.handlePasswordReset(job)).rejects.toBeInstanceOf(EmailExpiredError);
        expect(job.discard).toHaveBeenCalled();
        expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it("still sends a mail that is within its deliverBy window", async () => {
        const job = makeJob({
            data: { to: "a@b.com", subject: "s", html: "h", correlationId: "c", deliverBy: Date.now() + 60_000 },
        });
        await processor.handlePasswordReset(job);
        expect(emailService.sendEmail).toHaveBeenCalled();
    });
});

describe("refundAttempt", () => {
    it("subtracts one", () => {
        const job = makeJob({ attemptsMade: 3 });
        refundAttempt(job);
        expect(job.attemptsMade).toBe(2);
    });
});

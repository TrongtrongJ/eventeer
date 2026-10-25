import { Test } from "@nestjs/testing";
import { BullModule, getQueueToken } from "@nestjs/bull";
import { CircuitOpenError } from "@nestjs/resilience";
import type { Queue } from "bull";
import { EMAIL_BACKOFF, EMAIL_JOB_OPTIONS, emailBackoff } from "../../src/email/email-queue.config";
import { EmailProcessor } from "../../src/email/email.processor";
import { EmailService } from "../../src/email/email.service";

/**
 * Real Bull on real Redis, with the production job options and backoff strategy, and a fake SMTP.
 * What matters is what the queue does with jobs, not what nodemailer does.
 */
describe("Email queue under an SMTP outage (E2E)", () => {
    let queue: Queue;
    let close: () => Promise<void>;
    let smtp: { sendEmail: ReturnType<typeof vi.fn> };
    const QUEUE = `email-test-${Date.now()}`;

    // Fast version of the production strategy so the suite takes seconds, with the same decisions.
    const fastBackoff = (attemptsMade: number, err?: Error) => {
        const ms = emailBackoff(attemptsMade, err);
        return ms < 0 ? ms : 50;
    };

    beforeAll(async () => {
        smtp = { sendEmail: vi.fn() };
        const moduleRef = await Test.createTestingModule({
            imports: [
                BullModule.forRoot({
                    redis: {
                        host: process.env.REDIS_HOST ?? "localhost",
                        port: Number(process.env.REDIS_PORT ?? 6379),
                    },
                    settings: { backoffStrategies: { [EMAIL_BACKOFF]: fastBackoff } },
                }),
                BullModule.registerQueue({ name: "email" }),
            ],
            providers: [EmailProcessor, { provide: EmailService, useValue: smtp }],
        }).compile();
        await moduleRef.init();
        queue = moduleRef.get(getQueueToken("email"));
        await queue.empty();
        void QUEUE;
        close = async () => {
            await queue.empty();
            await moduleRef.close();
        };
    });

    afterAll(() => close());
    beforeEach(async () => {
        smtp.sendEmail.mockReset();
        await queue.empty();
    });

    const done = (jobId: string | number, timeoutMs = 15_000) =>
        new Promise<"completed" | "failed">((resolve, reject) => {
            const t = setTimeout(() => reject(new Error("job did not settle")), timeoutMs);
            queue.on(
                "global:completed",
                (id: string) => String(id) === String(jobId) && (clearTimeout(t), resolve("completed")),
            );
            queue.on(
                "global:failed",
                (id: string) => String(id) === String(jobId) && (clearTimeout(t), resolve("failed")),
            );
        });

    const add = (name = "password-reset", data: Record<string, unknown> = {}) =>
        queue.add(
            name,
            { to: "a@b.com", subject: "s", html: "h", correlationId: "cid", ...data },
            { ...EMAIL_JOB_OPTIONS, removeOnComplete: false, removeOnFail: false },
        );

    it("a circuit that stays open for 20 deliveries does not burn the job's 6 attempts", async () => {
        let rejected = 0;
        smtp.sendEmail.mockImplementation(async () => {
            if (rejected++ < 20) throw new CircuitOpenError("smtp", 1);
        });

        const job = await add();
        expect(await done(job.id)).toBe("completed");

        expect(smtp.sendEmail).toHaveBeenCalledTimes(21);
        const settled = await queue.getJob(job.id);
        expect(settled!.attemptsMade).toBe(0); // 20 rejections cost nothing (Bull's default would have failed it at 6)
    });

    it("real failures still count, and the job fails after its attempts", async () => {
        smtp.sendEmail.mockRejectedValue(Object.assign(new Error("connection reset"), { code: "ECONNRESET" }));
        const job = await add();
        expect(await done(job.id)).toBe("failed");
        expect(smtp.sendEmail).toHaveBeenCalledTimes(EMAIL_JOB_OPTIONS.attempts!);
    });

    it("a permanent rejection (unknown mailbox) fails at once instead of retrying", async () => {
        smtp.sendEmail.mockRejectedValue(
            Object.assign(new Error("550 no such user"), { code: "EPROTOCOL", responseCode: 550 }),
        );
        const job = await add();
        expect(await done(job.id)).toBe("failed");
        expect(smtp.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("an expired mail is dropped without being sent or retried", async () => {
        const job = await add("password-reset", { deliverBy: Date.now() - 1000 });
        expect(await done(job.id)).toBe("failed");
        expect(smtp.sendEmail).not.toHaveBeenCalled();
    });

    it("recovers: after the outage the very same job is delivered", async () => {
        smtp.sendEmail
            .mockRejectedValueOnce(new CircuitOpenError("smtp", 1))
            .mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }))
            .mockResolvedValue(undefined);
        const job = await add("email-verification");
        expect(await done(job.id)).toBe("completed");
        expect((await queue.getJob(job.id))!.attemptsMade).toBe(1); // only the real failure counted
    });
});

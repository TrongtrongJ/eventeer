import { ResilienceTimeoutError } from "@nestjs/resilience";
import { isPermanentSmtpFailure, isSmtpOutage } from "./smtp-errors";

const smtp = (code: string | undefined, responseCode?: number) =>
    Object.assign(new Error("smtp"), { code, responseCode });

describe("isSmtpOutage (what may open the SMTP circuit)", () => {
    it.each(["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED", "EDNS"])("counts unreachable server: %s", code => {
        expect(isSmtpOutage(smtp(code))).toBe(true);
    });

    it.each([421, 451, 452, 454, 530, 535])("counts server-wide reply %i", rc => {
        expect(isSmtpOutage(smtp("EPROTOCOL", rc))).toBe(true);
    });

    it("counts the policy's own timeout", () => {
        expect(isSmtpOutage(new ResilienceTimeoutError(15_000, "smtp"))).toBe(true);
    });

    it.each([550, 553, 554])(
        "does NOT count a rejected recipient/message (%i): one bad address must not open it",
        rc => {
            expect(isSmtpOutage(smtp("EPROTOCOL", rc))).toBe(false);
        },
    );

    it("does not count invalid envelopes or unknown programming errors", () => {
        expect(isSmtpOutage(smtp("EENVELOPE"))).toBe(false);
        expect(isSmtpOutage(new TypeError("template bug"))).toBe(false);
        expect(isSmtpOutage(undefined)).toBe(false);
    });
});

describe("isPermanentSmtpFailure (stop retrying)", () => {
    it.each([550, 551, 552, 553, 554, 501])("is permanent for reply %i", rc => {
        expect(isPermanentSmtpFailure(smtp("EPROTOCOL", rc))).toBe(true);
    });

    it("is permanent for invalid envelope / message", () => {
        expect(isPermanentSmtpFailure(smtp("EENVELOPE"))).toBe(true);
        expect(isPermanentSmtpFailure(smtp("EMESSAGE"))).toBe(true);
    });

    it("is NOT permanent for outages or credential problems (they get fixed, then the mail should go out)", () => {
        expect(isPermanentSmtpFailure(smtp("ETIMEDOUT"))).toBe(false);
        expect(isPermanentSmtpFailure(smtp("EPROTOCOL", 421))).toBe(false);
        expect(isPermanentSmtpFailure(smtp("EAUTH", 535))).toBe(false);
    });
});

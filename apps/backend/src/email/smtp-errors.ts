import { ResilienceTimeoutError } from "@nestjs/resilience";

interface SmtpError {
    code?: unknown;
    responseCode?: unknown;
}

/** Network-level nodemailer / Node error codes: the server was not reachable or stopped talking. */
const UNREACHABLE_CODES = new Set([
    "ECONNECTION",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ESOCKET",
    "ETLS",
    "EDNS",
    "ENOTFOUND",
    "EAI_AGAIN",
    "EHOSTUNREACH",
    "ENETUNREACH",
]);

/**
 * Replies that describe the server (busy, shutting down, TLS unavailable) or our credentials
 * (auth required / rejected), i.e. every message would fail the same way.
 */
const SERVER_WIDE_RESPONSES = new Set([421, 451, 452, 454, 530, 534, 535]);

/** Replies that reject this one message or recipient. Retrying the same message cannot change them. */
const PERMANENT_RESPONSES = new Set([501, 550, 551, 552, 553, 554]);

const responseCodeOf = (error: unknown): number | undefined => {
    const code = (error as SmtpError | null)?.responseCode;
    return typeof code === "number" ? code : undefined;
};

const codeOf = (error: unknown): string | undefined => {
    const code = (error as SmtpError | null)?.code;
    return typeof code === "string" ? code : undefined;
};

/**
 * Should this failure count against the SMTP circuit breaker? Only outages do. A mailbox that does not
 * exist (550) or a malformed address (EENVELOPE) is one bad message, and must never open the circuit
 * for everyone else's password reset.
 */
export function isSmtpOutage(error: unknown): boolean {
    if (error instanceof ResilienceTimeoutError) return true;
    const code = codeOf(error);
    if (code && UNREACHABLE_CODES.has(code)) return true;
    const response = responseCodeOf(error);
    return response !== undefined && SERVER_WIDE_RESPONSES.has(response);
}

/** True when retrying the same message can never succeed, so the queue should stop at once. */
export function isPermanentSmtpFailure(error: unknown): boolean {
    const code = codeOf(error);
    if (code === "EENVELOPE" || code === "EMESSAGE") return true;
    const response = responseCodeOf(error);
    return response !== undefined && PERMANENT_RESPONSES.has(response);
}

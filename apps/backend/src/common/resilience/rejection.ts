import { BulkheadFullError, CircuitOpenError, OutboundRateLimitError } from "@nestjs/resilience";

export type Rejection = CircuitOpenError | BulkheadFullError | OutboundRateLimitError;

/** A policy refused to start the call (the package does not export the common base class). */
export const isRejection = (error: unknown): error is Rejection =>
    error instanceof CircuitOpenError || error instanceof BulkheadFullError || error instanceof OutboundRateLimitError;

import { z } from "zod";

/** Normalised so lookups and uniqueness checks are case-insensitive by construction. */
export const emailField = z
  .email("Must be a valid email address")
  .max(254, "The email is too long")
  .trim()
  .toLowerCase();

export const IsoStringDate = z.preprocess(
  (val) => (val instanceof Date ? val.toISOString() : val),
  z.iso.datetime(),
);

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

/**
 * bcrypt silently truncates input beyond 72 bytes, so cap the length rather
 * than letting two different long passwords hash identically.
 */
export const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(
    passwordRegex,
    "Password must contain at least one uppercase letter, one lowercase letter, and one number",
  );

import { z } from "zod";

export const emailField = z.email("Must be a valid email address").max(254, "The email is too long");

export const IsoStringDate = z.preprocess(
  (val) => (val instanceof Date ? val.toISOString() : val),
  z.iso.datetime() 
);

const passwordRegex: RegExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
export const passwordField = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(passwordRegex, "Password must contain at least one uppercase letter, one lowercase letter, and one number");

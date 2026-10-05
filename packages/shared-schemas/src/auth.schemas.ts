import { z } from "zod";
import { emailField, IsoStringDate, passwordField } from "./base/fields";

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------
export const RegisterSchema = z
  .object({
    email: emailField,
    password: passwordField,
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    /** Defaults to CUSTOMER. ADMIN sign-up is gated server-side (ALLOW_ADMIN_SIGNUP). */
    role: z.enum(["CUSTOMER", "ORGANIZER", "ADMIN"]).optional(),
  })
  .meta({ description: "New user registration payload" });

export const LoginSchema = z
  .object({
    email: emailField,
    // No strength rules on login: never reject an existing password client-side.
    password: z.string().min(1).max(72),
  })
  .meta({ description: "User login credentials" });

export const ForgotPasswordSchema = z.object({ email: emailField });

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordField,
});

export const ResetPasswordFormSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const VerifyEmailSchema = z.object({ token: z.string().min(1) });

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------
export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().optional(),
  role: z.enum(["ADMIN", "ORGANIZER", "CUSTOMER"]),
  provider: z.enum(["LOCAL", "GOOGLE", "GITHUB", "FACEBOOK"]).optional(),
  isEmailVerified: z.boolean(),
  isActive: z.boolean(),
  lastLoginAt: IsoStringDate.nullable().optional(),
  createdAt: IsoStringDate,
  updatedAt: IsoStringDate.nullable().optional(),
});

/**
 * Auth responses never carry tokens: the access and refresh tokens are opaque,
 * httpOnly cookies that JavaScript (and therefore XSS) can never read.
 */
export const AuthResponseSchema = z
  .object({ user: UserSchema })
  .meta({ id: "AuthResponse", description: "Authenticated user; tokens are set as httpOnly cookies" });

export const MessageResponseSchema = z.object({ message: z.string() }).meta({ id: "MessageResponse" });

export const ErrorResponseSchema = z
  .object({
    statusCode: z.number().int(),
    message: z.union([z.string(), z.array(z.string())]),
    error: z.string().optional(),
  })
  .meta({ id: "ErrorResponse" });

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
export type ResetPasswordFormDto = z.infer<typeof ResetPasswordFormSchema>;
export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;
export type UserDto = z.infer<typeof UserSchema>;
export type OAuthProvider = UserDto["provider"];
export type AuthResponseDto = z.infer<typeof AuthResponseSchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// User Schemas
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export const ResetPasswordFormSchema = z
  .object({
    password: z.string().min(8, "Password too short").max(100, 'Password too long'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  avatarUrl: z.string().optional(),
  role: z.enum(["ADMIN", "ORGANIZER", "CUSTOMER"]),
  provider: z.enum(["LOCAL", "GOOGLE", "GITHUB", "FACEBOOK"]),
  isEmailVerified: z.boolean(),
  isActive: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserSchema,
  expiresIn: z.number(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const OAuth2CallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
export type ResetPasswordFormDto = z.infer<typeof ResetPasswordFormSchema>;
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
export type UserDto = z.infer<typeof UserSchema>;
export type UserRole = UserDto['role'];
export type OAuthProvider = UserDto['provider'];
export type AuthResponseDto = z.infer<typeof AuthResponseSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
export type OAuth2CallbackDto = z.infer<typeof OAuth2CallbackSchema>;
export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;

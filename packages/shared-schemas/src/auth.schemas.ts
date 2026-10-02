import { z } from "zod";
import { IsoStringDate } from "./base/fields";

// User Schemas
export const RegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(100),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
}).meta({
  description: "New user registration payload",
  examples: [
      {
          email: "user@example.com",
          password: "Secret123",
          confirmPassword: "Secret123",
      },
  ],
});

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
}).meta({
  description: "User login credentials",
  examples: [{ email: "user@example.com", password: "Secret123" }],
});;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export const ForgotPasswordSchema = z.object({
  email: z.email(),
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
  avatarUrl: z.url().optional(),
});

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

const MinimalUserData = UserSchema.pick({
    id: true,
    email: true,
});

const JwtUserDataSchema = MinimalUserData.transform(({ id, ...rest }) => ({
    ...rest,
    sub: id,
}));

export const AuthResponseSchema = z
    .object({
      accessToken: z.string(),
      refreshToken: z.string(),
      //user: UserSchema,
      user: MinimalUserData,
      expiresIn: z.number(),
    })
    .meta({
        id: "AuthResponse",
        description: "Successful authentication response",
    });

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
export type ResetPasswordFormDto = z.infer<typeof ResetPasswordFormSchema>;
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
export type UserDto = z.infer<typeof UserSchema>;
export type OAuthProvider = UserDto['provider'];
export type AuthResponseDto = z.infer<typeof AuthResponseSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
export type OAuth2CallbackDto = z.infer<typeof OAuth2CallbackSchema>;
export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;

export const MeSchema = z
    .object({
        user: MinimalUserData,
    })
    .meta({ id: "Me", description: "User get me return object" });

export const MessageResponseSchema = z
    .object({
        message: z.string(),
    })
    .meta({ id: "MessageResponse" });

export const ErrorResponseSchema = z
    .object({
        statusCode: z.number().int(),
        message: z.union([z.string(), z.array(z.string())]),
        error: z.string().optional(),
    })
    .meta({ id: "ErrorResponse" });

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------
export type Me = z.infer<typeof MeSchema>;
export type JwtUserData = z.infer<typeof JwtUserDataSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type MessageResponse = z.infer<typeof MessageResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;


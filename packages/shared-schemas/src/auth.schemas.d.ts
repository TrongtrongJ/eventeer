import { z } from "zod";
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
}, {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
}>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
    password?: string;
}, {
    email?: string;
    password?: string;
}>;
export declare const ChangePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword?: string;
    newPassword?: string;
}, {
    currentPassword?: string;
    newPassword?: string;
}>;
export declare const ForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email?: string;
}, {
    email?: string;
}>;
export declare const ResetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token?: string;
    newPassword?: string;
}, {
    token?: string;
    newPassword?: string;
}>;
export declare const UpdateProfileSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
}, {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
}>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    avatarUrl: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<["ADMIN", "ORGANIZER", "CUSTOMER"]>;
    provider: z.ZodEnum<["LOCAL", "GOOGLE", "GITHUB", "FACEBOOK"]>;
    isEmailVerified: z.ZodBoolean;
    isActive: z.ZodBoolean;
    lastLoginAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    role?: "ADMIN" | "ORGANIZER" | "CUSTOMER";
    provider?: "LOCAL" | "GOOGLE" | "GITHUB" | "FACEBOOK";
    isEmailVerified?: boolean;
    isActive?: boolean;
    lastLoginAt?: string;
    createdAt?: string;
    updatedAt?: string;
}, {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    role?: "ADMIN" | "ORGANIZER" | "CUSTOMER";
    provider?: "LOCAL" | "GOOGLE" | "GITHUB" | "FACEBOOK";
    isEmailVerified?: boolean;
    isActive?: boolean;
    lastLoginAt?: string;
    createdAt?: string;
    updatedAt?: string;
}>;
export declare const AuthResponseSchema: z.ZodObject<{
    accessToken: z.ZodString;
    refreshToken: z.ZodString;
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        firstName: z.ZodString;
        lastName: z.ZodString;
        avatarUrl: z.ZodOptional<z.ZodString>;
        role: z.ZodEnum<["ADMIN", "ORGANIZER", "CUSTOMER"]>;
        provider: z.ZodEnum<["LOCAL", "GOOGLE", "GITHUB", "FACEBOOK"]>;
        isEmailVerified: z.ZodBoolean;
        isActive: z.ZodBoolean;
        lastLoginAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
        role?: "ADMIN" | "ORGANIZER" | "CUSTOMER";
        provider?: "LOCAL" | "GOOGLE" | "GITHUB" | "FACEBOOK";
        isEmailVerified?: boolean;
        isActive?: boolean;
        lastLoginAt?: string;
        createdAt?: string;
        updatedAt?: string;
    }, {
        id?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
        role?: "ADMIN" | "ORGANIZER" | "CUSTOMER";
        provider?: "LOCAL" | "GOOGLE" | "GITHUB" | "FACEBOOK";
        isEmailVerified?: boolean;
        isActive?: boolean;
        lastLoginAt?: string;
        createdAt?: string;
        updatedAt?: string;
    }>;
    expiresIn: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    accessToken?: string;
    refreshToken?: string;
    user?: {
        id?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
        role?: "ADMIN" | "ORGANIZER" | "CUSTOMER";
        provider?: "LOCAL" | "GOOGLE" | "GITHUB" | "FACEBOOK";
        isEmailVerified?: boolean;
        isActive?: boolean;
        lastLoginAt?: string;
        createdAt?: string;
        updatedAt?: string;
    };
    expiresIn?: number;
}, {
    accessToken?: string;
    refreshToken?: string;
    user?: {
        id?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string;
        role?: "ADMIN" | "ORGANIZER" | "CUSTOMER";
        provider?: "LOCAL" | "GOOGLE" | "GITHUB" | "FACEBOOK";
        isEmailVerified?: boolean;
        isActive?: boolean;
        lastLoginAt?: string;
        createdAt?: string;
        updatedAt?: string;
    };
    expiresIn?: number;
}>;
export declare const RefreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken?: string;
}, {
    refreshToken?: string;
}>;
export declare const OAuth2CallbackSchema: z.ZodObject<{
    code: z.ZodString;
    state: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code?: string;
    state?: string;
}, {
    code?: string;
    state?: string;
}>;
export declare const VerifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token?: string;
}, {
    token?: string;
}>;
export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
export type UserDto = z.infer<typeof UserSchema>;
export type AuthResponseDto = z.infer<typeof AuthResponseSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
export type OAuth2CallbackDto = z.infer<typeof OAuth2CallbackSchema>;
export type VerifyEmailDto = z.infer<typeof VerifyEmailSchema>;

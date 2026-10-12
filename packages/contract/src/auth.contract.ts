import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { createBaseResponse, responseWithMessage, responseWithNullData } from "./base/base-response.dto";
import {
    AuthResponseSchema,
    ForgotPasswordSchema,
    LoginSchema,
    RegisterSchema,
    ResetPasswordSchema,
    UserSchema,
    VerifyEmailSchema,
} from "@packages/shared-schemas";

const responseWithAuthSchema = createBaseResponse(AuthResponseSchema);
export const authContract = oc.router({
    register: oc
        .input(RegisterSchema)
        .output(responseWithAuthSchema)
        .meta(
            openapi({
                method: "POST",
                path: "/auth/register",
                description: "Register user",
                tags: ['Auth']
            }),
        ),
    login: oc
        .input(LoginSchema)
        .output(responseWithAuthSchema)
        .errors({
            UNAUTHORIZED: {
                message: "Invalid email or password",
            },
            FORBIDDEN: {
                message: "This account has been disabled",
            },
        })
        .meta(
            openapi({
                method: "POST",
                path: "/auth/login",
                description: "Login user",
                tags: ['Auth']
            }),
        ),
    me: oc.output(createBaseResponse(UserSchema)).meta(
        openapi({
            method: "GET",
            path: "/auth/me",
            description: "Get me",
            tags: ['Auth']
        }),
    ),
    refresh: oc.output(createBaseResponse(UserSchema)).meta(
        openapi({
            method: "POST",
            path: "/auth/refresh",
            description: "Refresh user auth",
            tags: ['Auth']
        }),
    ),
    logout: oc.output(responseWithNullData).meta(
        openapi({
            method: "POST",
            path: "/auth/logout",
            description: "Logout user",
            tags: ['Auth']
        }),
    ),
    verifyEmail: oc
        .input(VerifyEmailSchema)
        .output(responseWithMessage)
        .meta(
            openapi({
                method: "POST",
                path: "/auth/verify-email",
                description: "Verify user email",
                tags: ['Auth']
            }),
        ),
    forgotPassword: oc
        .input(ForgotPasswordSchema)
        .output(responseWithMessage)
        .meta(
            openapi({
                method: "POST",
                path: "/auth/forgot-password",
                description: "Forgot password",
                tags: ['Auth']
            }),
        ),
    resetPassword: oc
        .input(ResetPasswordSchema)
        .output(responseWithMessage)
        .meta(
            openapi({
                method: "POST",
                path: "/auth/reset-password",
                description: "Reset password",
                tags: ['Auth']
            }),
        ),
});

import { oc } from '@orpc/contract';
import { openapi } from '@orpc/openapi';
import { z } from 'zod';
import { createBaseResponse, responseWithMessage, responseWithNullData } from './base/base-response.dto';
import { AuthResponseSchema, ForgotPasswordSchema, LoginSchema, RegisterSchema, ResetPasswordSchema, UserSchema, VerifyEmailSchema } from '@packages/shared-schemas';

const responseWithAuthSchema = createBaseResponse(AuthResponseSchema);
export const authContract = oc.router({
  register: oc
      .input(RegisterSchema)
      .output(responseWithAuthSchema)
      .meta(openapi({ 
        method: 'POST', 
        path: '/register',
        description: 'Register user' 
      })),
  login: oc
      .input(LoginSchema)
      .output(responseWithAuthSchema)
      .meta(openapi({ 
        method: 'POST', 
        path: '/login',
        description: 'Login user' 
      })),
  me: oc
      .output(createBaseResponse(UserSchema))
      .meta(openapi({ 
        method: 'GET', 
        path: '/me',
        description: 'Get me' 
      })),
  refresh: oc
      .output(createBaseResponse(UserSchema))
      .meta(openapi({ 
        method: 'POST', 
        path: '/refresh',
        description: 'Refresh user auth' 
      })),
  logout: oc
      .output(responseWithNullData)
      .meta(openapi({
        method: 'POST',
        path: '/logout',
        description: 'Logout user'
      })),
  verifyEmail: oc
      .input(VerifyEmailSchema)
      .output(responseWithMessage)
      .meta(openapi({
        method: 'POST',
        path: '/verify-email',
        description: 'Verify user email'
      })),
  forgotPassword: oc
      .input(ForgotPasswordSchema)
      .output(responseWithMessage)
      .meta(openapi({
        method: 'POST',
        path: '/forgot-password',
        description: 'Forgot password'
      })),
  resetPassword: oc
      .input(ResetPasswordSchema)
      .output(responseWithMessage)
      .meta(openapi({
        method: 'POST',
        path: '/reset-password',
        description: 'Reset password'
      })),
})
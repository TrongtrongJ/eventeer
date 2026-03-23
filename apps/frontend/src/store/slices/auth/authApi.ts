import { 
  AuthResponseDto, 
  ChangePasswordDto, 
  ForgotPasswordDto, 
  LoginDto, 
  RegisterDto, 
  ResetPasswordDto, 
  ResetPasswordFormDto, 
  UserDto 
} from '@event-mgmt/shared-schemas';
import { apiSlice } from '../apiSlice';
import { setCredentials, clearCredentials, setUserData } from './authSlice';
import { addToast } from '../ui';

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponseDto, LoginDto>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setCredentials({ 
            user: data.user, 
            accessToken: data.accessToken, 
            refreshToken: data.refreshToken,
            expiresIn: data.expiresIn,
          }));
        } catch (err: any) {
          dispatch(addToast({
            type: 'error', message: err.message || "Login failed"
          }))
        }
      },
    }),
    getMe: builder.query<UserDto, void>({
      query: () => '/auth/me',
      providesTags: ['User'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUserData(data)); // Sync the user profile to Redux
        } catch (err: any) {
          dispatch(addToast({
            type: 'error', message: err.message || "Refetch session failed"
          }))
          dispatch(clearCredentials()); // If the token is invalid, clear everything
        }
      },
    }),
    registerUser: builder.mutation<UserDto, RegisterDto>({
      query: (registerUserFormDto) => ({
        url: '/auth/register',
        method: 'POST',
        body: registerUserFormDto
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(addToast({
            type: 'success', message: 'Register user successful!'
          }))
        } catch (err: any) {
          dispatch(addToast({
            type: 'error', message: err.message || 'Failed to register user!'
          }))
        }
      },
    }),
    resetPassword: builder.mutation<ResetPasswordFormDto, ResetPasswordFormDto>({
      query: (resetPasswordFormDto) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body: resetPasswordFormDto
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(addToast({
            type: 'success', message: 'Password reset successful!'
          }))
        } catch (err: any) {
          dispatch(addToast({
            type: 'error', message: err.message || 'Failed to reset password'
          }))
        }
      },
    }),
    forgotPassword: builder.mutation<void, ForgotPasswordDto>({
      query: (forgotPasswordDto) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body: forgotPasswordDto
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(addToast({
            type: 'success', message: 'Password reset email sent!'
          }))
        } catch (err: any) {
          dispatch(addToast({
            type: 'error', message: err.message || 'Failed to reset password'
          }))
        }
      },
    })
  })
})

export const { 
  useLoginMutation, 
  useGetMeQuery, 
  useRegisterUserMutation,
  useResetPasswordMutation, 
  useForgotPasswordMutation,
} = authApi;
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { isDefinedError, ORPCError } from '@orpc/client';
import { orpc } from '../query';
import { createQueryWrapper } from '@/test-utils/query-test-utils';
import { authApiMock, mockAuthResponse, mockUser, validEmail, validPassword } from './mock-data/auth.mock';

describe('orpc.auth', () => {
  describe('login', () => {
    it('should return tokens and minimal user data on valid credentials', async () => {
      authApiMock.useMockLogin();

      const { result } = renderHook(() => useMutation(orpc.auth.login.mutationOptions()), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({ email: validEmail, password: validPassword });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toEqual(mockAuthResponse);
    });

    it('should surface a 401 error on invalid credentials', async () => {
      authApiMock.useMockLogin();

      const { result } = renderHook(() => useMutation(orpc.auth.login.mutationOptions()), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({ email: validEmail, password: 'wrong-password' });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const error = result.current.error as ORPCError<any, any>;

      if (isDefinedError(error: any)) {
        expect(error.data?.status).toBe(401);
      }
    });
  });

  describe('register', () => {
    it('should create a new user and return credentials', async () => {
      authApiMock.useMockRegister();

      const { result } = renderHook(() => useMutation(orpc.auth.register.mutationOptions()), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({
        email: 'new-user@eventeer.com',
        password: validPassword,
        firstName: 'New',
        lastName: 'User',
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toEqual(mockAuthResponse);
    });

    it('should surface a 409 error if the email is already registered', async () => {
      authApiMock.useMockRegister();

      const { result } = renderHook(() => useMutation(orpc.auth.register.mutationOptions()), {
        wrapper: createQueryWrapper(),
      });

      result.current.mutate({
        email: 'taken@eventeer.com',
        password: validPassword,
        firstName: 'Taken',
        lastName: 'User',
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const error = result.current.error as ORPCError<any, any>;

      if (isDefinedError(error: any)) {
        expect(error.data?.status).toBe(409);
      }
    });
  });

  describe('me', () => {
    it("should return the authenticated user's profile", async () => {
      authApiMock.useMockMe(mockUser);

      const { result } = renderHook(() => useQuery(orpc.auth.me.queryOptions()), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.data).toEqual(mockUser);
    });

    it('should return a 401 error when not authenticated', async () => {
      authApiMock.useMockMe(null);

      const { result } = renderHook(() => useQuery(orpc.auth.me.queryOptions()), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      const error = result.current.error as ORPCError<any, any>;

      if (isDefinedError(error: any)) {
        expect(error.data?.status).toBe(409);
      }
    });
  });
});

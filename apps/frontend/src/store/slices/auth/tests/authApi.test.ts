import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { authApi } from "../authApi";
import { AppStore } from '../../../index';
import { setupTestStore } from "../../../../test-utils/test-utils";
import { 
  authApiMock,
  validAccessToken, 
  createMockRootStateWithTokens, 
  mockRegisterUserData, 
  validEmail,
  validPassword,
  mockAuthResponse,
  validRefreshToken,
} from './mock-data';

describe("authApi (RTK Query)", () => {
  let testStore: AppStore;

  describe('standard auth flows', () => {
    beforeAll(() => {
      testStore = setupTestStore();
      authApiMock.useMockRefreshAuth();
    });

    afterEach(() => {
      testStore.dispatch(authApi.util.resetApiState())
    });

    describe("login mutation", () => {
      it("should return user and token on valid credentials", async () => {
        testStore = setupTestStore({ 
          ...createMockRootStateWithTokens(validAccessToken, validRefreshToken)
        })
        authApiMock.useMockLogin();
        const result = await testStore.dispatch(
          authApi.endpoints.login.initiate({ email: validEmail, password: validPassword })
        ).unwrap();
        expect(result).toEqual(mockAuthResponse);
      });

      it("should return 401 on invalid credentials", async () => {
        testStore = setupTestStore({ 
          ...createMockRootStateWithTokens('wrong-token', 'wrong-token-again')
        })
        authApiMock.useMockLogin();
        const result = await testStore.dispatch(
          authApi.endpoints.login.initiate({ email: validEmail, password: "password123" })
        );
        expect(result.error).toMatchObject({ status: 401 });
      });
    });

    describe("register mutation", () => {
      it("should create a new user and return credentials", async () => {
        authApiMock.useMockRegisterUser();
        const result = await testStore!.dispatch(
          authApi.endpoints.registerUser.initiate({
            ...mockRegisterUserData
          })
        ).unwrap();
        const { password, ...rest } = mockRegisterUserData;
        expect(result).containSubset({ ...rest });
      });

      it("should return 409 if email already exists", async () => {
        authApiMock.useMockRegisterUser();
        const result = await testStore!.dispatch(
          authApi.endpoints.registerUser.initiate({ 
            ...mockRegisterUserData,
            email: 'steven-ponder@eventeer.com'
          })
        );
        expect(result.error).toMatchObject({ status: 409 });
      });
    });
  });

  describe('getMe query', () => {
    afterEach(() => {
      testStore?.dispatch(authApi.util.resetApiState())
    });

    it("should return authenticated user's profile", async () => {
      authApiMock.useMockAuthHeaderCheck();
      authApiMock.useMockRefreshAuth();
      
      testStore = setupTestStore({ 
        ...createMockRootStateWithTokens(validAccessToken, validRefreshToken)
      });
      const result = await testStore.dispatch(
        authApi.endpoints.getMe.initiate()
      ).unwrap();
      expect(result).toEqual({ ...mockAuthResponse });
    });

    it("should return 401 if no valid token is present", async () => {
      authApiMock.useMockAuthHeaderCheck();
      authApiMock.useMockRefreshAuth();
      testStore = setupTestStore({ 
        ...createMockRootStateWithTokens('invalid-token', 'invalid-token-again')
      });
      const result = await testStore.dispatch(
        authApi.endpoints.getMe.initiate()
      );
      expect(result.error).toMatchObject({ status: 401 });
    });
  });
});



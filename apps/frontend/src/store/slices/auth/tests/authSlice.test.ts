import { describe, it, expect } from 'vitest';
import authReducer, {
  defaultInitialState,
  setCredentials,
  clearCredentials,
  selectCurrentUserData,
  selectUserAccessToken,
  selectIsAuthenticated,
} from "../authSlice";
import { 
  mockAuthResponse, 
  mockLoggedInAuthState, 
  mockLoggedInRootState, 
  mockUserData, 
  validAccessToken 
} from './mock-data';
import { RootState } from '../../../index';

describe("authSlice", () => {
  const initialState = { ...defaultInitialState };

  describe("reducers", () => {
    it("should return the initial state", () => {
      expect(authReducer(undefined, { type: "unknown" })).toEqual(initialState);
    });

    it("should handle setCredentials", () => {
      expect(authReducer(initialState, setCredentials(mockAuthResponse))).toEqual({
        ...mockLoggedInAuthState
      });
    });

    it("should handle logout and clear state", () => {
      expect(authReducer(mockLoggedInAuthState, clearCredentials())).toEqual(initialState);
    });
  });

  describe("selectors", () => {
    const rootState = mockLoggedInRootState as RootState

    it("selectCurrentUser should return the current user", () => {
      expect(selectCurrentUserData(rootState)).toEqual(mockUserData);
    });

    it("selectCurrentToken should return the current token", () => {
      expect(selectUserAccessToken(rootState)).toBe(validAccessToken);
    });

    it("selectIsAuthenticated should return false when logged out", () => {
      const rootDefaultState = { auth: initialState } as RootState
      expect(selectIsAuthenticated(rootDefaultState)).toBe(false);
    });
  });
});
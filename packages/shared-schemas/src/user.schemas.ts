/**
 * The authenticated principal attached to every request by the auth guard.
 * Single source of truth: previously this interface was declared four times.
 */
export interface CurrentUserData {
  userId: string;
  email: string;
  role: "ADMIN" | "ORGANIZER" | "CUSTOMER";
  /** Id of the `auth_sessions` row backing this request's access token. */
  sessionId: string;
}

export interface JwtUserData { 
  sub: CurrentUserData['userId'];
  email: CurrentUserData['email']; 
};

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CurrentUserData } from '@packages/shared-schemas';
import { getRequest } from '../utils/request.util';

/** Injects the authenticated principal into REST and GraphQL handlers. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): CurrentUserData => {
  return (getRequest(ctx) as unknown as { user: CurrentUserData }).user;
});

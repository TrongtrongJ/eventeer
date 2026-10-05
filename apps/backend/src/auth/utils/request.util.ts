import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';

/**
 * Resolves the underlying Express request for both REST/oRPC and GraphQL
 * execution contexts so a single set of global guards covers every surface.
 * Returns undefined for non-request contexts (e.g. WebSocket handlers).
 */
export function getRequest(context: ExecutionContext): Request | undefined {
  switch (context.getType<string>()) {
    case 'http':
      return context.switchToHttp().getRequest<Request>();
    case 'graphql':
      return GqlExecutionContext.create(context).getContext<{ req: Request }>().req;
    default:
      return undefined;
  }
}

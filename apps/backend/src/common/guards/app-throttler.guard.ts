import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/** ThrottlerGuard that understands GraphQL and ignores non-HTTP contexts (websockets). */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const type = context.getType<string>();
    if (type !== 'http' && type !== 'graphql') return true;
    return super.canActivate(context);
  }

  getRequestResponse(context: ExecutionContext) {
    if (context.getType<string>() === 'graphql') {
      const { req, res } = GqlExecutionContext.create(context).getContext();
      return { req, res };
    }
    return super.getRequestResponse(context);
  }
}

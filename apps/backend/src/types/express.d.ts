import { CurrentUserData } from '@packages/shared-schemas';
import { Request } from 'express'

/* declare global {
  namespace Express {
    interface Request {
      user?: CurrentUserData;
    }
  }
} */

declare interface ReqWithCorrId extends Request {
  user?: CurrentUserData
  correlationId: string
}

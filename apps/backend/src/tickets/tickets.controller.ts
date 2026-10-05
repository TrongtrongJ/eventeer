import { Controller } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { ticketContract } from '@packages/contract';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { withCorrelationId } from '../common/middleware/correlation-id.middleware';
import { withCurrentUser } from '../common/middleware/current-user.middleware';
import { requireRoles } from '../common/middleware/require-roles.middleware';
import { Public } from '../auth/decorators/public.decorator';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /** Door scanning: organizers (for their own events) and admins only. */
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Implement(ticketContract.validate)
  async validate() {
    return implement(ticketContract.validate)
      .use(withCorrelationId)
      .use(withCurrentUser)
      .use(requireRoles([UserRole.ORGANIZER, UserRole.ADMIN]))
      .handler(async ({ input, context }) => {
        const { user, correlationId } = context;
        const result = await this.ticketsService.validateTicket(input, user, correlationId);
        return {
          success: result.isValid,
          data: result,
          correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  /** Public by design: the QR code itself is the unguessable (256-bit) credential. */
  @Public()
  @Implement(ticketContract.lookup)
  async lookup() {
    return implement(ticketContract.lookup)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const ticket = await this.ticketsService.getTicketByQRCode(input.qrCode);
        return {
          success: true,
          data: ticket,
          correlationId: context.correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }
}

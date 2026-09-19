import { Controller } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Implement } from '@orpc/nest';
import { implement } from '@orpc/server';
import { ticketContract } from '@packages/contract';
import { withCorrelationId } from '../common/middleware/correlation-id.middleware';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Implement(ticketContract.validate)
  async validate(
  ) {
    return implement(ticketContract.validate)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { correlationId } = context;
        const result = await this.ticketsService.validateTicket(input, correlationId);
        return {
          success: result.isValid,
          data: result,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }

  @Implement(ticketContract.lookup)
  async lookup() {
    return implement(ticketContract.lookup)
      .use(withCorrelationId)
      .handler(async ({ input, context }) => {
        const { qrCode } = input;
        const { correlationId } = context;
        const ticket = await this.ticketsService.getTicketByQRCode(qrCode);
        return {
          success: true,
          data: ticket,
          correlationId: correlationId,
          timestamp: new Date().toISOString(),
        };
      });
  }
}

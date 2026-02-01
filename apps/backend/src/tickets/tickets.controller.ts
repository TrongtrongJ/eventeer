import { Controller, Post, Get, Body, Query, Req } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { ValidateTicketDto, ValidateTicketSchema } from '@event-mgmt/shared-schemas';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('validate')
  async validate(
    @Body(new ZodValidationPipe(ValidateTicketSchema))
    validateDto: ValidateTicketDto,
    @Req() req: any,
  ) {
    const result = await this.ticketsService.validateTicket(validateDto, req.correlationId);
    return {
      success: result.isValid,
      data: result,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('lookup')
  async lookup(@Query('qrCode') qrCode: string, @Req() req: any) {
    const ticket = await this.ticketsService.getTicketByQRCode(qrCode);
    return {
      success: true,
      data: ticket,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString(),
    };
  }
}

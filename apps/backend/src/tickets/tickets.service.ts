import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { ValidateTicketDto } from '@event-mgmt/shared-schemas';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  async validateTicket(
    validateDto: ValidateTicketDto,
    correlationId: string,
  ): Promise<{
    isValid: boolean;
    ticket?: any;
    message: string;
  }> {
    this.logger.log({
      message: 'Validating ticket',
      correlationId,
      ticketId: validateDto.ticketId,
    });

    const ticket = await this.ticketRepository.findOne({
      where: { id: validateDto.ticketId },
      relations: ['booking', 'booking.event'],
    });

    if (!ticket) {
      return {
        isValid: false,
        message: 'Ticket not found',
      };
    }

    if (ticket.qrCode !== validateDto.qrCode) {
      this.logger.warn({
        message: 'Invalid QR code',
        correlationId,
        ticketId: validateDto.ticketId,
      });
      return {
        isValid: false,
        message: 'Invalid QR code',
      };
    }

    if (ticket.isValidated) {
      this.logger.warn({
        message: 'Ticket already validated',
        correlationId,
        ticketId: validateDto.ticketId,
        validatedAt: ticket.validatedAt,
      });
      return {
        isValid: false,
        ticket: {
          ticketNumber: ticket.ticketNumber,
          validatedAt: ticket.validatedAt,
        },
        message: 'Ticket already used',
      };
    }

    // Mark as validated
    ticket.isValidated = true;
    ticket.validatedAt = new Date();
    await this.ticketRepository.save(ticket);

    this.logger.log({
      message: 'Ticket validated successfully',
      correlationId,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
    });

    return {
      isValid: true,
      ticket: {
        ticketNumber: ticket.ticketNumber,
        eventTitle: ticket.booking.event.title,
        holderName: `${ticket.booking.firstName} ${ticket.booking.lastName}`,
        validatedAt: ticket.validatedAt,
      },
      message: 'Ticket validated successfully',
    };
  }

  async getTicketByQRCode(qrCode: string): Promise<any> {
    const ticket = await this.ticketRepository.findOne({
      where: { qrCode },
      relations: ['booking', 'booking.event'],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      isValidated: ticket.isValidated,
      validatedAt: ticket.validatedAt?.toISOString(),
      eventTitle: ticket.booking.event.title,
      eventDate: ticket.booking.event.startDate.toISOString(),
      holderName: `${ticket.booking.firstName} ${ticket.booking.lastName}`,
    };
  }
}

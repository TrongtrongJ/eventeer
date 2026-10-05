import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { EventTicketDataDto, ValidateTicketDto, ValidateTicketResDto } from '@packages/shared-schemas';
import { Ticket } from '../entities/ticket.entity';
import { BookingStatus } from '../entities/booking.entity';
import { UserRole } from '../entities/user.entity';
import { safeEqual } from '../auth/utils/token.util';

export interface Scanner {
  userId: string;
  role: string;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  async validateTicket(dto: ValidateTicketDto, scanner: Scanner, correlationId: string): Promise<ValidateTicketResDto> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: dto.ticketId },
      relations: { booking: { event: true } },
    });

    // One generic answer for "unknown ticket" and "wrong QR": don't help someone probe ids.
    if (!ticket || !safeEqual(ticket.qrCode, dto.qrCode)) {
      this.logger.warn({ message: 'Ticket rejected: not found or QR mismatch', correlationId, ticketId: dto.ticketId });
      return { isValid: false, message: 'Invalid ticket' };
    }

    const { booking } = ticket;
    if (scanner.role !== UserRole.ADMIN && booking.event.organizerId !== scanner.userId) {
      throw new ForbiddenException('You can only validate tickets for your own events');
    }

    // Unpaid, expired, or refunded bookings must never get anyone through the door.
    if (booking.status !== BookingStatus.CONFIRMED) {
      return { isValid: false, message: `Booking is ${booking.status.toLowerCase()}` };
    }

    // Atomic claim: of two simultaneous scans, exactly one updates a row.
    const claimedAt = new Date();
    const claim = await this.ticketRepository.update({ id: ticket.id, isValidated: false }, { isValidated: true, validatedAt: claimedAt });

    if (claim.affected !== 1) {
      const current = await this.ticketRepository.findOneByOrFail({ id: ticket.id });
      return {
        isValid: false,
        ticket: {
          ticketNumber: ticket.ticketNumber,
          validatedAt: current.validatedAt ? current.validatedAt.toISOString() : undefined,
        },
        message: 'Ticket already used',
      };
    }

    this.logger.log({ message: 'Ticket validated', correlationId, ticketId: ticket.id, ticketNumber: ticket.ticketNumber });
    return {
      isValid: true,
      ticket: {
        ticketNumber: ticket.ticketNumber,
        eventTitle: booking.event.title,
        holderName: `${booking.firstName} ${booking.lastName}`,
        validatedAt: claimedAt.toISOString(),
      },
      message: 'Ticket validated successfully',
    };
  }

  async getTicketByQRCode(qrCode: string): Promise<EventTicketDataDto> {
    const ticket = await this.ticketRepository.findOne({
      where: { qrCode },
      relations: { booking: { event: true } },
    });
    if (!ticket || ticket.booking.status !== BookingStatus.CONFIRMED) throw new NotFoundException('Ticket not found');

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

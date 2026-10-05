import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Event } from '../entities/event.entity';
import { CreateEventDto, UpdateEventDto, EventDto } from '@packages/shared-schemas';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { buildPaginatedResponse, PaginationInput } from '../common/pagination';
import { ResourceNotFoundException } from '../common/exceptions/business.exception';

export interface EventFilters {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  startDate?: string;
  endDate?: string;
  availableOnly?: boolean;
}

/** Row shape returned by the atomic seat UPDATE ... RETURNING. */
export interface ReservedEvent {
  id: string;
  title: string;
  ticketPrice: string; // pg returns decimals as strings
  currency: string;
  capacity: number;
  availableSeats: number;
}

const SORTABLE = ['startDate', 'ticketPrice', 'capacity', 'createdAt', 'title'] as const;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async findAllPaginated(pagination: PaginationInput, filters: EventFilters) {
    const { page = 1, limit = 10, sortBy = 'startDate', sortOrder = 'DESC', search } = pagination;

    const qb = this.eventRepository.createQueryBuilder('event').leftJoinAndSelect('event.organizer', 'organizer');

    if (search) {
      qb.andWhere('(event.title ILIKE :search OR event.description ILIKE :search OR event.location ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (filters.location) qb.andWhere('event.location ILIKE :location', { location: `%${filters.location}%` });
    if (filters.minPrice !== undefined) qb.andWhere('event.ticketPrice >= :minPrice', { minPrice: filters.minPrice });
    if (filters.maxPrice !== undefined) qb.andWhere('event.ticketPrice <= :maxPrice', { maxPrice: filters.maxPrice });
    if (filters.startDate) qb.andWhere('event.startDate >= :from', { from: new Date(filters.startDate) });
    if (filters.endDate) qb.andWhere('event.startDate <= :to', { to: new Date(filters.endDate) });
    if (filters.availableOnly) qb.andWhere('event.availableSeats > 0');

    const sortField = (SORTABLE as readonly string[]).includes(sortBy) ? sortBy : 'startDate';
    qb.orderBy(`event.${sortField}`, sortOrder);

    const [events, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return buildPaginatedResponse(
      events.map((e) => this.toDto(e)),
      total,
      page,
      limit,
    );
  }

  async create(dto: CreateEventDto, organizerId: string, correlationId: string): Promise<EventDto> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.assertValidWindow(startDate, endDate);

    const event = await this.eventRepository.save(
      this.eventRepository.create({
        ...dto,
        organizerId,
        availableSeats: dto.capacity,
        startDate,
        endDate,
      }),
    );

    this.logger.log({ message: 'Event created', correlationId, eventId: event.id, organizerId });
    return this.toDto(event);
  }

  async findByOrganizer(organizerId: string): Promise<EventDto[]> {
    const events = await this.eventRepository.find({
      where: { organizerId },
      order: { startDate: 'DESC' },
      relations: ['organizer'],
    });
    return events.map((e) => this.toDto(e));
  }

  async findOne(id: string, correlationId?: string): Promise<EventDto> {
    const event = await this.eventRepository.findOne({ where: { id }, relations: ['organizer'] });
    if (!event) {
      this.logger.warn({ message: 'Event not found', correlationId, eventId: id });
      throw new ResourceNotFoundException('Event', id);
    }
    return this.toDto(event);
  }

  async update(id: string, dto: UpdateEventDto, correlationId: string): Promise<EventDto> {
    const event = await this.eventRepository.findOne({ where: { id }, relations: ['organizer'] });
    if (!event) throw new ResourceNotFoundException('Event', id);

    const startDate = dto.startDate ? new Date(dto.startDate) : event.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : event.endDate;
    this.assertValidWindow(startDate, endDate);

    // Changing capacity must preserve the number of seats already sold.
    if (dto.capacity !== undefined && dto.capacity !== event.capacity) {
      const sold = event.capacity - event.availableSeats;
      if (dto.capacity < sold) {
        throw new BadRequestException(`Capacity cannot be lower than the ${sold} seats already booked`);
      }
      event.availableSeats = dto.capacity - sold;
      event.capacity = dto.capacity;
    }

    const { startDate: _s, endDate: _e, capacity: _c, ...rest } = dto;
    Object.assign(event, rest, { startDate, endDate });

    const saved = await this.eventRepository.save(event);
    this.logger.log({ message: 'Event updated', correlationId, eventId: id });
    this.broadcastSeats(saved.id, saved.availableSeats, saved.capacity);
    return this.toDto(saved);
  }

  async delete(id: string, correlationId: string): Promise<void> {
    try {
      const result = await this.eventRepository.delete(id);
      if (result.affected === 0) throw new ResourceNotFoundException('Event', id);
    } catch (err: any) {
      // bookings.eventId is ON DELETE RESTRICT: never silently destroy sales history.
      if (err?.driverError?.code === '23503') {
        throw new ConflictException('This event has bookings and cannot be deleted');
      }
      throw err;
    }
    this.logger.log({ message: 'Event deleted', correlationId, eventId: id });
  }

  // ── Seat accounting ───────────────────────────────────────────────────────

  /**
   * Atomically takes `quantity` seats in ONE conditional statement. Concurrent
   * buyers serialise on the row lock and the WHERE clause guarantees none can
   * oversell; losers get a clean "not enough seats" instead of a lock error.
   * Must be called inside the caller's transaction so the reservation rolls back
   * together with the booking.
   */
  async reserveSeats(manager: EntityManager, eventId: string, quantity: number): Promise<ReservedEvent> {
    const result = await manager
      .createQueryBuilder()
      .update(Event)
      .set({ availableSeats: () => '"availableSeats" - :quantity' })
      .where('id = :eventId AND "availableSeats" >= :quantity AND "endDate" > now()', { eventId, quantity })
      .returning(['id', 'title', 'ticketPrice', 'currency', 'capacity', 'availableSeats'])
      .execute();

    const row = result.raw[0] as ReservedEvent | undefined;
    if (row) return row;

    const event = await manager.findOne(Event, { where: { id: eventId } });
    if (!event) throw new ResourceNotFoundException('Event', eventId);
    if (event.endDate <= new Date()) throw new BadRequestException('This event has already ended');
    throw new BadRequestException(
      event.availableSeats === 0 ? 'This event is sold out' : `Only ${event.availableSeats} seat(s) left`,
    );
  }

  /** Returns seats to inventory (cancellation / expiry). Capped at capacity. */
  async releaseSeats(manager: EntityManager, eventId: string, quantity: number): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(Event)
      .set({ availableSeats: () => 'LEAST("capacity", "availableSeats" + :quantity)' })
      .where('id = :eventId', { eventId, quantity })
      .execute();
  }

  /** Call AFTER the transaction commits so clients never see uncommitted state. */
  async broadcastSeatsFor(eventId: string): Promise<void> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: { id: true, availableSeats: true, capacity: true },
    });
    if (event) this.broadcastSeats(event.id, event.availableSeats, event.capacity);
  }

  private broadcastSeats(eventId: string, availableSeats: number, capacity: number) {
    this.websocketGateway.emitSeatUpdate({
      eventId,
      availableSeats,
      capacity,
      timestamp: new Date().toISOString(),
    });
  }

  private assertValidWindow(start: Date, end: Date) {
    if (end <= start) throw new BadRequestException('Event end date must be after the start date');
  }

  private toDto(event: Event): EventDto {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      capacity: event.capacity,
      availableSeats: event.availableSeats,
      ticketPrice: Number(event.ticketPrice),
      currency: event.currency as EventDto['currency'],
      imageUrl: event.imageUrl ?? undefined,
      organizerId: event.organizerId ?? undefined,
      organizerName: event.organizer ? `${event.organizer.firstName} ${event.organizer.lastName}` : undefined,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}

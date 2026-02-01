import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like, DataSource, EntityManager } from 'typeorm';
import { Event } from '../entities/event.entity';
import { CreateEventDto, UpdateEventDto, EventDto } from '@event-mgmt/shared-schemas';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { PaginationQueryDto, PaginatedResponseDto } from '../common/dto/pagination.dto';
import { ResourceNotFoundException } from '../common/exceptions/business.exception';

export interface EventFilters {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  startDate?: string;
  endDate?: string;
  availableOnly?: boolean;
}


interface PaginationOptions {
  page: number;
  limit: number;
  search?: string;
  location?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly websocketGateway: WebsocketGateway,
    private readonly dataSource: DataSource
  ) {}

  async findAllPaginated(
    pagination: PaginationQueryDto,
    filters: EventFilters,
    baseUrl?: string,
  ): Promise<PaginatedResponseDto<EventDto>> {
    const { page = 1, limit = 10, sortBy = 'startDate', sortOrder = 'ASC', search } = pagination;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: FindOptionsWhere<Event> = {};

    if (search) {
      where.title = Like(`%${search}%`);
    }

    if (filters.location) {
      where.location = Like(`%${filters.location}%`);
    }

    if (filters.availableOnly) {
      // This would need a custom query builder for complex conditions
    }

    // Build query
    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.organizer', 'organizer');

    // Apply search
    if (search) {
      queryBuilder.where(
        '(event.title ILIKE :search OR event.description ILIKE :search OR event.location ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Apply filters
    if (filters.location) {
      queryBuilder.andWhere('event.location ILIKE :location', {
        location: `%${filters.location}%`,
      });
    }

    if (filters.minPrice !== undefined) {
      queryBuilder.andWhere('event.ticketPrice >= :minPrice', {
        minPrice: filters.minPrice,
      });
    }

    if (filters.maxPrice !== undefined) {
      queryBuilder.andWhere('event.ticketPrice <= :maxPrice', {
        maxPrice: filters.maxPrice,
      });
    }

    if (filters.startDate) {
      queryBuilder.andWhere('event.startDate >= :startDate', {
        startDate: new Date(filters.startDate),
      });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('event.startDate <= :endDate', {
        endDate: new Date(filters.endDate),
      });
    }

    if (filters.availableOnly) {
      queryBuilder.andWhere('event.availableSeats > 0');
    }

    // Apply sorting
    const allowedSortFields = ['startDate', 'ticketPrice', 'capacity', 'createdAt', 'title'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'startDate';
    queryBuilder.orderBy(`event.${sortField}`, sortOrder);

    // Get total count
    const total = await queryBuilder.getCount();

    // Get paginated results
    const events = await queryBuilder.skip(skip).take(limit).getMany();

    const eventDtos = events.map((event) => this.toDto(event));

    return new PaginatedResponseDto(eventDtos, total, page, limit, baseUrl);
  }

  async create(
    createEventDto: CreateEventDto,
    organizerId: string,
    correlationId: string,
  ): Promise<EventDto> {
    this.logger.log({
      message: 'Creating new event',
      correlationId,
      title: createEventDto.title,
      organizerId,
    });

    const event = this.eventRepository.create({
      ...createEventDto,
      organizerId,
      availableSeats: createEventDto.capacity,
      startDate: new Date(createEventDto.startDate),
      endDate: new Date(createEventDto.endDate),
    });

    const savedEvent = await this.eventRepository.save(event);

    this.logger.log({
      message: 'Event created successfully',
      correlationId,
      eventId: savedEvent.id,
      organizerId,
    });

    return this.toDto(savedEvent);
  }

  async findAll(): Promise<EventDto[]> {
    const events = await this.eventRepository.find({
      order: { startDate: 'ASC' },
      relations: ['organizer'],
    });
    return events.map((event) => this.toDto(event));
  }

  async findByOrganizer(organizerId: string): Promise<EventDto[]> {
    const events = await this.eventRepository.find({
      where: { organizerId },
      order: { startDate: 'DESC' },
      relations: ['organizer'],
    });
    return events.map((event) => this.toDto(event));
  }

  async findOne(id: string, correlationId?: string): Promise<EventDto> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });

    if (!event) {
      this.logger.warn({
        message: 'Event not found',
        correlationId,
        eventId: id,
      });
      throw new ResourceNotFoundException('Event', id);
    }

    return this.toDto(event);
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    correlationId: string,
  ): Promise<EventDto> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['organizer'],
    });

    if (!event) {
      throw new ResourceNotFoundException('Event', id);
    }

    const updateData: any = { ...updateEventDto };
    if (updateEventDto.startDate) {
      updateData.startDate = new Date(updateEventDto.startDate);
    }
    if (updateEventDto.endDate) {
      updateData.endDate = new Date(updateEventDto.endDate);
    }

    Object.assign(event, updateData);
    const updatedEvent = await this.eventRepository.save(event);

    this.logger.log({
      message: 'Event updated',
      correlationId,
      eventId: id,
    });

    return this.toDto(updatedEvent);
  }

  async updateAvailableSeats(
    eventId: string,
    change: number,
    correlationId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.transaction(async (manager) => {
      console.log("before finding one !!!")
      const event = await manager.findOne(Event, {
        where: { id: eventId },
        lock: { mode: 'pessimistic_write_or_fail' },
      });

      console.log("after finding one !!!")

      if (!event) {
        throw new ResourceNotFoundException('Event', eventId);
      }

      const newAvailable = event.availableSeats + change;

      console.log({
        newAvailable
      })

      if (newAvailable < 0) {
        throw new Error('Insufficient available seats');
      }

      if (newAvailable > event.capacity) {
        throw new Error('Available seats cannot exceed capacity');
      }

      event.availableSeats = newAvailable;
      event.version += 1;

      await manager.save(event);

      console.log("After manager save av seats!!!")

      this.logger.log({
        message: 'Seat availability updated',
        correlationId,
        eventId,
        change,
        newAvailable,
      });

      // Emit real-time update
      this.websocketGateway.emitSeatUpdate({
        eventId: event.id,
        availableSeats: event.availableSeats,
        capacity: event.capacity,
        timestamp: new Date().toISOString(),
      });
    });
  }
 /* async updateAvailableSeats(eventId: string, change: number, correlationId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    await queryRunner.connect();
    await queryRunner.startTransaction();

    console.log("Starting available seats transaction !!!!")

    try {
      // Lock the event row with FOR UPDATE
      const event = await queryRunner.manager
        .createQueryBuilder(Event, 'event')
        .setLock('pessimistic_write')
        .where('event.id = :id', { id: eventId })
        .getOne();

      if (!event) {
        throw new NotFoundException(`Event with ID ${eventId} not found`);
      }

      const newAvailable = event.availableSeats + change;

      if (newAvailable < 0) {
        throw new Error('Insufficient available seats');
      }

      if (newAvailable > event.capacity) {
        throw new Error('Available seats cannot exceed capacity');
      }

      // Update using query builder to avoid version conflicts
      await queryRunner.manager
        .createQueryBuilder()
        .update(Event)
        .set({ 
          availableSeats: newAvailable,
          version: () => 'version + 1'
        })
        .where('id = :id', { id: eventId })
        .execute();

      await queryRunner.commitTransaction();

      this.logger.log({
        message: 'Seat availability updated',
        correlationId,
        eventId,
        change,
        newAvailable,
      });

      // Emit real-time update (outside transaction)
      this.websocketGateway.emitSeatUpdate({
        eventId: event.id,
        availableSeats: newAvailable,
        capacity: event.capacity,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error({
        message: 'Failed to update seat availability',
        correlationId,
        eventId,
        change,
        error: error.message,
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  } */


  async delete(id: string, correlationId: string): Promise<void> {
    const result = await this.eventRepository.delete(id);

    if (result.affected === 0) {
      throw new ResourceNotFoundException('Event', id);
    }

    this.logger.log({
      message: 'Event deleted',
      correlationId,
      eventId: id,
    });
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
      currency: event.currency as any,
      imageUrl: event.imageUrl,
      organizerId: event.organizerId,
      organizerName: event.organizer
        ? `${event.organizer.firstName} ${event.organizer.lastName}`
        : undefined,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventsService } from './events.service';
import { Event } from '../entities/event.entity';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { NotFoundException } from '@nestjs/common';
import { EntityManager, DataSource } from 'typeorm';
import { ResourceNotFoundException } from 'src/common/exceptions/business.exception';


describe('EventsService', () => {
  let service: EventsService;
  let repository: Repository<Event>;
  let module: TestingModule;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    manager: {
      transaction: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>,
  };

  const mockWebsocketGateway = {
    emitSeatUpdate: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: getRepositoryToken(Event),
          useValue: mockRepository,
        },
        {
          provide: WebsocketGateway,
          useValue: mockWebsocketGateway,
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    repository = module.get<Repository<Event>>(getRepositoryToken(Event));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new event', async () => {
      const createEventDto = {
        title: 'Test Event',
        description: 'Test Description',
        location: 'Test Location',
        startDate: '2025-12-31T00:00:00Z',
        endDate: '2025-12-31T23:59:59Z',
        capacity: 100,
        ticketPrice: 50,
        currency: 'USD' as const,
      };

      const mockEvent = {
        id: '123',
        ...createEventDto,
        availableSeats: 100,
        startDate: new Date(createEventDto.startDate),
        endDate: new Date(createEventDto.endDate),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockEvent);
      mockRepository.save.mockResolvedValue(mockEvent);

      const result = await service.create(createEventDto, 'test_org123', 'test-correlation-id');

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createEventDto,
        availableSeats: createEventDto.capacity,
        organizerId: "test_org123",
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockEvent);
      expect(result.title).toBe(createEventDto.title);
    });
  });

  describe('findOne', () => {
    it('should return an event by id', async () => {
      const mockEvent = {
        id: '123',
        title: 'Test Event',
        availableSeats: 50,
        startDate: new Date('2025-12-31T00:00:00Z'),
        endDate: new Date('2025-12-31T23:59:59Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Event;

      mockRepository.findOne.mockResolvedValue(mockEvent);

      const result = await service.findOne('123', 'test-correlation-id');

      expect(mockRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: '123' } }));
      expect(result.id).toBe('123');
    });

    it('should throw ResourceNotFoundException when event not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999', 'test-correlation-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateAvailableSeats', () => {
    it('should update available seats and emit websocket event', async () => {
      const mockEvent = {
        id: '123',
        availableSeats: 50,
        capacity: 100,
        version: 0,
      } as Event;

      mockRepository.manager.transaction.mockImplementation(async (callback) => {
        mockRepository.manager.findOne.mockResolvedValue(mockEvent);
        mockRepository.manager.save.mockResolvedValue({
          ...mockEvent,
          availableSeats: 45,
          version: 1,
        });
        return mockRepository.manager;
      });

      await service.updateAvailableSeats('123', -5, 'test-correlation-id', mockRepository.manager);

      expect(mockRepository.manager.findOne).toHaveBeenCalledWith(Event, {
        where: { id: '123' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(mockWebsocketGateway.emitSeatUpdate).toHaveBeenCalled();
    });

    it('should throw error when insufficient seats', async () => {
      const mockEvent = {
        id: '123',
        availableSeats: 5,
        capacity: 100,
      } as Event;

      mockRepository.manager.transaction.mockImplementation(async (callback) => {
        mockRepository.manager.findOne.mockResolvedValue(mockEvent);
        return mockRepository.manager;
      });

      await expect(service.updateAvailableSeats('123', -10, 'test-correlation-id', mockRepository.manager)).rejects.toThrow(
        'Insufficient available seats',
      );
    });
  });
});

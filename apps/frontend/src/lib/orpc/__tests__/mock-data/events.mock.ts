import { http, HttpResponse } from 'msw';
import type { EventDto, CreateEventDto } from '@packages/shared-schemas';
import { server } from '@/test-utils/server';
import { wrapResponse, wrapPaginated } from '@/test-utils/response-envelope';
import { apiUrl } from '../../config';

export const mockEvent1Title = 'Test Event 1';
export const mockEvent1Id = 'event-uuid-1';

export const mockEvent1: EventDto = {
  id: mockEvent1Id,
  title: mockEvent1Title,
  description: 'Greatest mock event in the project',
  location: 'Bangkok Bangna',
  startDate: '2026-09-10T02:00:00.000Z',
  endDate: '2026-09-15T17:00:00.000Z',
  capacity: 1000,
  ticketPrice: 599,
  currency: 'THB',
  imageUrl: undefined,
  organizerId: 'organizer-uuid-1',
  organizerName: 'Trong',
  availableSeats: 500,
  createdAt: '2026-03-10T17:26:54.773Z',
  updatedAt: '2026-03-10T17:26:54.773Z',
};

export const mockEventNewTitle = 'Trong Charity Project Fair';
export const mockEventNewId = 'event-uuid-2';

export function buildMockNewEvent(): EventDto {
  const now = new Date().toISOString();
  return {
    id: mockEventNewId,
    title: mockEventNewTitle,
    description: 'Even greater mock event in the project',
    location: 'Bangkok Bangna',
    startDate: '2026-09-10T03:00:00.000Z',
    endDate: '2026-09-12T17:00:00.000Z',
    capacity: 200,
    ticketPrice: 10,
    currency: 'USD',
    imageUrl: undefined,
    organizerId: 'organizer-uuid-trong',
    organizerName: 'Trong',
    availableSeats: 200,
    createdAt: now,
    updatedAt: now,
  };
}

let mockEventDb: EventDto[] = [mockEvent1];

export function resetMockEventDb() {
  mockEventDb = [mockEvent1];
}

export const eventsApiMock = {
  useMockEventsList: () =>
    server.use(
      http.get(`${apiUrl}/events`, () =>
        HttpResponse.json(wrapPaginated(structuredClone(mockEventDb)), { status: 200 }),
      ),
    ),

  useMockEventCreation: () =>
    server.use(
      http.post(`${apiUrl}/events`, async ({ request }) => {
        const body = (await request.json()) as CreateEventDto;
        const newEvent: EventDto = {
          ...buildMockNewEvent(),
          ...body,
          startDate: typeof body.startDate === 'string' ? body.startDate : body.startDate.toISOString(),
          endDate: typeof body.endDate === 'string' ? body.endDate : body.endDate.toISOString(),
        };
        mockEventDb.push(newEvent);
        return HttpResponse.json(wrapResponse(newEvent), { status: 201 });
      }),
    ),
};

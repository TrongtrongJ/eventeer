import { http, HttpResponse } from 'msw';
import { server } from '../../../../test-utils/server';
import { EventDto } from '@event-mgmt/shared-schemas';
import { RootState } from '../../../index';

export const mockEvent1Title = 'Test Event 1';

export const mockEvent1: EventDto = {
  id: 'random-uuid-1',
  title: mockEvent1Title,
  description: 'Greatest mock event in the project',
  location: 'Bangkok Bangna',
  startDate: "2026-09-10T02:00:00.000Z",
  endDate: "2026-09-15T17:00:00.000Z",
  capacity: 1000,
  ticketPrice: 599,
  currency: "THB",
  imageUrl: undefined,
  organizerId: 'organizer-uuid-1',
  organizerName: 'Trong',
  availableSeats: 0,
  createdAt: "2026-03-10T17:26:54.773Z",
  updatedAt: "2026-03-10T17:26:54.773Z",
}

const currentDateString = new Date().toISOString();

export const mockEventNewTitle = 'Trong Charity Project Fair';
export const mockEventNew: EventDto = {
  id: 'random-uuid-2',
  title: mockEventNewTitle,
  description: 'Event greater mock event in the project',
  location: 'Bangkok Bangna',
  startDate: "2026-09-10T03:00:00.000Z",
  endDate: "2026-09-12T17:00:00.000Z",
  capacity: 200,
  ticketPrice: 10,
  currency: "USD",
  imageUrl: undefined,
  organizerId: 'organizer-uuid-trong',
  organizerName: 'Trong',
  availableSeats: 200,
  createdAt: currentDateString,
  updatedAt: currentDateString,
}
export let mockEventDb: EventDto[] = [ mockEvent1 ];
export function resetMockEventDb() {
  mockEventDb = [ mockEvent1 ];
};
export const eventsApiMock = {
  useMockEventsList: () => server.use(http.get(`*/events`, () => {
    return HttpResponse.json(structuredClone(mockEventDb), { status: 200 });
  })),
  useMockEventCreation: () => server.use(http.post(`*/events`, async ({ request }) => {
    const newEvent = await request.json();
    mockEventDb.push(newEvent as EventDto);
    return HttpResponse.json(structuredClone(newEvent), { status: 201 });
  }))
}
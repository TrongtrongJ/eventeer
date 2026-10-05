import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpc } from '../query';
import { createTestQueryClient, createQueryWrapper } from '@/test-utils/query-test-utils';
import { eventsApiMock, mockEventNewTitle, resetMockEventDb } from './mock-data/events.mock';

/**
 * Unlike RTK Query's automatic tag-based invalidation, TanStack Query has no
 * built-in concept of "this mutation invalidates that query" - the app code
 * has to call queryClient.invalidateQueries() explicitly (see
 * app/create/CreateEventClient.tsx's onSuccess handler). This test verifies
 * that pattern actually targets the right cache key rather than relying on
 * "the framework handles it".
 */
describe('orpc.events cache invalidation', () => {
  beforeAll(() => {
    eventsApiMock.useMockEventsList();
    eventsApiMock.useMockEventCreation();
  });

  beforeEach(() => {
    resetMockEventDb();
  });

  it('should reflect a newly created event in the list once invalidated', async () => {
    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(
      () => ({
        list: useQuery(orpc.events.findAll.queryOptions({ input: { pagination: {} } })),
        create: useMutation(orpc.events.create.mutationOptions()),
        queryClient: useQueryClient(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(result.current.list.data?.data).toHaveLength(1);

    result.current.create.mutate({
      title: mockEventNewTitle,
      description: 'A brand new event',
      location: 'Bangkok',
      startDate: new Date('2026-11-01T10:00:00.000Z'),
      endDate: new Date('2026-11-01T18:00:00.000Z'),
      capacity: 50,
      ticketPrice: 20,
      currency: 'THB',
    });

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));

    // This is the line under test - it must use the same query key the
    // findAll queryOptions() call produces, or the list silently goes stale.
    await result.current.queryClient.invalidateQueries({ queryKey: orpc.events.key() });

    await waitFor(() => expect(result.current.list.data?.data).toHaveLength(2));
    expect(result.current.list.data?.data[1].title).toBe(mockEventNewTitle);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { orpc } from '../query';
import { createQueryWrapper } from '@/test-utils/query-test-utils';
import { eventsApiMock, mockEvent1Title, resetMockEventDb } from './mock-data/events.mock';

describe('orpc.events.findAll', () => {
  beforeAll(() => {
    eventsApiMock.useMockEventsList();
  });

  it('should fetch events successfully', async () => {
    resetMockEventDb();

    const { result } = renderHook(
      () => useQuery(orpc.events.findAll.queryOptions({ input: { pagination: {} } })),
      { wrapper: createQueryWrapper() },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].title).toBe(mockEvent1Title);
  });
});

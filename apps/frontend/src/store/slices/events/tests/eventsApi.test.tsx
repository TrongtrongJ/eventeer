import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { apiSlice } from '../../apiSlice';
import { useGetEventsQuery } from '../eventsApi';
import { server } from '../../../../test-utils/server';
import { eventsApiMock, mockEvent1Title } from './mock-data';
import { setupTestStore } from '../../../../test-utils/test-utils';

const testStore = setupTestStore();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={testStore}>{children}</Provider>
);

describe('eventsApi', () => {
  
  // 1. Setup MSW Lifecycle
  beforeAll(() => {
    eventsApiMock.useMockEventsList();
  })

  afterEach(() => {
    server.resetHandlers();
    // IMPORTANT: Clear the RTK Query cache after every test
    testStore.dispatch(apiSlice.util.resetApiState());
  });

  it('should fetch events successfully', async () => {
    const { result } = renderHook(() => useGetEventsQuery(), { wrapper });

    // Initially, it should be loading
    expect(result.current.isLoading).toBe(true);

    // Wait for the MSW mock to return data
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].title).toBe(mockEvent1Title);
  });
});
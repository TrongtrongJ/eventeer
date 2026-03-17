import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux'
import { useGetEventsQuery, useCreateEventMutation } from '../eventsApi';
import { setupTestStore } from '../../../../test-utils/test-utils'; // Assume you moved the store setup here
import { apiSlice } from '../../apiSlice';
import { AppStore } from '../../..';
import { eventsApiMock, mockEventNew, mockEventNewTitle, resetMockEventDb } from './mock-data';

let store: AppStore;
let wrapper = ({ children }: any) => <Provider store={store}>{children}</Provider>;

describe('Events Invalidation', () => {

  beforeAll(() => {
    store = setupTestStore();
    eventsApiMock.useMockEventsList();
    eventsApiMock.useMockEventCreation();
  });

  beforeEach(() => {
    resetMockEventDb()
    store.dispatch(apiSlice.util.resetApiState());
  });

  it('should refetch the list automatically after a new event is created', async () => {
    // 1. Render both hooks
    const { result: listHook } = renderHook(() => useGetEventsQuery(), { wrapper });
    const { result: mutationHook } = renderHook(() => useCreateEventMutation(), { wrapper });

    // 2. Wait for the initial list to load
    await waitFor(() => expect(listHook.current.isSuccess).toBe(true));
    expect(listHook.current.data).toHaveLength(1);

    // 3. Trigger the mutation
    const [createEvent] = mutationHook.current;
    
    // We don't even need to 'await' the result here to see the "magic"
    createEvent(mockEventNew);

    // 4. THE MAGIC: Wait for the listHook to have 2 items
    // RTK Query sees the tag invalidation and triggers the GET request automatically
    await waitFor(
      () => expect(listHook.current.data).toHaveLength(2),
      { timeout: 2000 }
    );

    expect(listHook.current.data?.[1].title).toBe(mockEventNewTitle);
  });
});
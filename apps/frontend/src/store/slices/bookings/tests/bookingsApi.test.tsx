import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { bookingsApi} from '../bookingsApi';
import { apiSlice } from '../../apiSlice';
import { server } from '../../../../test-utils/server';
import { setupTestStore } from '../../../../test-utils/test-utils';
import { 
  bookingsApiMock, 
  mockBooking1Id, 
  mockCreateNewBookingData, 
  mockEvent1Id, 
  resetMockBookingsDb
} from './mock-data';

const testStore = setupTestStore();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={testStore}>{children}</Provider>
);

describe('bookingsApi - Functional Tests', () => {

  afterEach(() => {
    server.resetHandlers();
    testStore.dispatch(apiSlice.util.resetApiState());
    resetMockBookingsDb();
  })

  it('should fetch all bookings for the current user', async () => {
    bookingsApiMock.useMockMyBookingsList();
    const { result } = renderHook(() => bookingsApi.useGetMyBookingsQuery(), {
      wrapper,
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({ id: mockBooking1Id, eventId: mockEvent1Id });
  });

  it('should successfully create a new booking', async () => {
    bookingsApiMock.useMockMyBookingsList();
    bookingsApiMock.useMockCreateBooking();
    const { result } = renderHook(() => bookingsApi.useCreateBookingMutation(), {
      wrapper,
    });

    const [createBooking] = result.current;

    let mutationResult: any;
    await waitFor(async () => {
      mutationResult = await createBooking(mockCreateNewBookingData);
      expect(mutationResult.data).toBeDefined();
    });

    expect(mutationResult.data.status).toBe('CONFIRMED');
  });

  it('should handle 500 server errors gracefully', async () => {
    // Override handler for this specific test
    bookingsApiMock.useMockErrorMyBookingsList();

    const { result } = renderHook(() => bookingsApi.useGetMyBookingsQuery(), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { Provider } from 'react-redux';
import { bookingsApi } from '../bookingsApi';
import { server } from '../../../../test-utils/server';
import { setupTestStore } from '../../../../test-utils/test-utils';
import { bookingsApiMock, mockBooking1Id, mockCreateNewBookingData, resetMockBookingsDb } from './mock-data';
import { apiSlice } from '../../apiSlice';

const testStore = setupTestStore();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={testStore}>{children}</Provider>
);

describe('bookingsApi - Tag Invalidation', () => {

  afterEach(() => {
    server.resetHandlers();
    resetMockBookingsDb();
    testStore.dispatch(apiSlice.util.resetApiState());
  });

  it('should re-fetch the bookings list once after a successful creation', async () => {
    const countState = {
      callCount: 0
    }

    // Spy on the GET endpoint to count how many times it is called
    bookingsApiMock.useMockMyBookingsList(countState);
    bookingsApiMock.useMockCreateBooking();

    const { result } = renderHook(() => ({
      get: bookingsApi.useGetMyBookingsQuery(),
      create: bookingsApi.useCreateBookingMutation(),
    }), {
      wrapper,
    });

    // 1. Initial Fetch
    await waitFor(() => expect(result.current.get.isSuccess).toBe(true));
    expect(countState.callCount).toBe(1);

    // 2. Perform Mutation
    const [createBooking] = result.current.create;
    await createBooking(mockCreateNewBookingData);

    // 3. Verify that callCount increases to 2 
    // This proves the 'Bookings' tag was invalidated and auto-refetched
    await waitFor(() => expect(countState.callCount).toBe(2));
  });

  it('should invalidate specific booking details when updated', async () => {

    const countState = {
      callCount: 0
    };

    bookingsApiMock.useMockMyBookingsList();
    bookingsApiMock.useMockGetBookingById(countState);
    bookingsApiMock.useMockDeleteBookingById();

    const { result } = renderHook(() => ({
      getDetail: bookingsApi.useGetBookingByIdQuery(mockBooking1Id),
      cancel: bookingsApi.useCancelBookingMutation(),
    }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.getDetail.isSuccess).toBe(true));
    expect(countState.callCount).toBe(1);

    const [cancelBooking] = result.current.cancel;
    await cancelBooking(mockBooking1Id);

    // Verification of specific item invalidation
    await waitFor(() => expect(countState.callCount).toBe(2));
  });
});
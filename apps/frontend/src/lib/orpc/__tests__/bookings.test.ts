import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { orpc } from '../query';
import { createQueryWrapper } from '@/test-utils/query-test-utils';
import {
  bookingsApiMock,
  mockBooking1Id,
  mockEvent1Id,
  mockCreateNewBookingData,
  resetMockBookingsDb,
} from './mock-data/bookings.mock';

describe('orpc.bookings - functional tests', () => {
  afterEach(() => {
    resetMockBookingsDb();
  });

  it('should fetch all bookings for the current user', async () => {
    bookingsApiMock.useMockMyBookingsList();

    const { result } = renderHook(() => useQuery(orpc.bookings.getMyBookings.queryOptions()), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0]).toMatchObject({ id: mockBooking1Id, eventId: mockEvent1Id });
  });

  it('should successfully create a new booking', async () => {
    bookingsApiMock.useMockCreateBooking();

    const { result } = renderHook(() => useMutation(orpc.bookings.createBooking.mutationOptions()), {
      wrapper: createQueryWrapper(),
    });

    result.current.mutate(mockCreateNewBookingData);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.status).toBe('PENDING');
  });

  it('should handle 500 server errors gracefully', async () => {
    bookingsApiMock.useMockErrorMyBookingsList();

    const { result } = renderHook(() => useQuery(orpc.bookings.getMyBookings.queryOptions()), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});

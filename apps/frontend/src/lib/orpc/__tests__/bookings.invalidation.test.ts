import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpc } from '../query';
import { createTestQueryClient, createQueryWrapper } from '@/test-utils/query-test-utils';
import { bookingsApiMock, mockBookingNewId } from './mock-data/bookings.mock';

/**
 * Mirrors app/checkout/[bookingId]/CheckoutClient.tsx: after confirmBooking
 * succeeds, it calls queryClient.invalidateQueries({ queryKey: orpc.bookings.key() }).
 * This proves that call actually causes the booking detail query to refetch
 * and pick up the new CONFIRMED status, rather than just trusting it "should".
 */
describe('orpc.bookings cache invalidation', () => {
  it('should refetch the booking detail with updated status after confirmBooking', async () => {
    bookingsApiMock.useMockConfirmBookingFlow();

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(
      () => ({
        detail: useQuery(orpc.bookings.findOne.queryOptions({ input: { id: mockBookingNewId } })),
        confirm: useMutation(orpc.bookings.confirmBooking.mutationOptions()),
        queryClient: useQueryClient(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
    expect(result.current.detail.data?.data.status).toBe('PENDING');

    result.current.confirm.mutate({ id: mockBookingNewId });
    await waitFor(() => expect(result.current.confirm.isSuccess).toBe(true));

    await result.current.queryClient.invalidateQueries({ queryKey: orpc.bookings.key() });

    await waitFor(() => expect(result.current.detail.data?.data.status).toBe('CONFIRMED'));
  });
});

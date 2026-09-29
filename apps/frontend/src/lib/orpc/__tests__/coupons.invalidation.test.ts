import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orpc } from '../query';
import { createTestQueryClient, createQueryWrapper } from '@/test-utils/query-test-utils';
import { couponsApiMock, mockCouponId, mockEventId, resetMockCouponsDb } from './mock-data/coupons.mock';

/**
 * Mirrors EventCouponItem.tsx's toggleCouponStatus: after updateCoupon
 * succeeds, it invalidates orpc.coupons.getEventCoupons.key() - this proves
 * the list re-fetches and reflects the new isActive value.
 */
describe('orpc.coupons cache invalidation', () => {
  beforeEach(() => {
    resetMockCouponsDb();
  });

  it('should reflect a toggled coupon status in the event coupons list', async () => {
    couponsApiMock.useMockEventCoupons();
    couponsApiMock.useMockUpdateCoupon();

    const queryClient = createTestQueryClient();
    const wrapper = createQueryWrapper(queryClient);

    const { result } = renderHook(
      () => ({
        list: useQuery(orpc.coupons.getEventCoupons.queryOptions({ input: { eventId: mockEventId } })),
        update: useMutation(orpc.coupons.updateCoupon.mutationOptions()),
        queryClient: useQueryClient(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(result.current.list.data?.data[0].isActive).toBe(true);

    result.current.update.mutate({ params: { id: mockCouponId }, body: { isActive: false } });
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));

    await result.current.queryClient.invalidateQueries({ queryKey: orpc.coupons.getEventCoupons.key() });

    await waitFor(() => expect(result.current.list.data?.data[0].isActive).toBe(false));
  });
});

import { http, HttpResponse } from 'msw';
import type { CouponDto } from '@packages/shared-schemas';
import { server } from '@/test-utils/server';
import { wrapResponse } from '@/test-utils/response-envelope';
import { apiUrl } from '../../config';

export const mockEventId = 'event-uuid-1';
export const mockCouponId = 'coupon-uuid-1';

export function buildMockCoupon(overrides: Partial<CouponDto> = {}): CouponDto {
  return {
    id: mockCouponId,
    code: 'SUMMER25',
    eventId: mockEventId,
    maxUsages: 100,
    expiresAt: '2026-12-31T23:59:59.000Z',
    minPurchaseAmount: 0,
    eventTicketPrice: 599,
    discountType: 'PERCENTAGE',
    discountValue: 25,
    currentUsages: 3,
    isActive: true,
    createdAt: '2026-03-10T17:26:54.773Z',
    updatedAt: '2026-03-10T17:26:54.773Z',
    ...overrides,
  };
}

let mockCouponsDb: CouponDto[] = [buildMockCoupon()];

export function resetMockCouponsDb() {
  mockCouponsDb = [buildMockCoupon()];
}

export const couponsApiMock = {
  useMockEventCoupons: () =>
    server.use(
      http.get(`${apiUrl}/coupons/event/:eventId`, () =>
        HttpResponse.json(wrapResponse(structuredClone(mockCouponsDb)), { status: 200 }),
      ),
    ),

  useMockUpdateCoupon: () =>
    server.use(
      http.patch(`${apiUrl}/coupons/:id`, async ({ params, request }) => {
        const body = (await request.json()) as { isActive: boolean };
        mockCouponsDb = mockCouponsDb.map((coupon) =>
          coupon.id === params.id ? { ...coupon, isActive: body.isActive } : coupon,
        );
        const updated = mockCouponsDb.find((coupon) => coupon.id === params.id)!;
        return HttpResponse.json(wrapResponse(updated), { status: 200 });
      }),
    ),
};

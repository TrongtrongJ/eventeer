import { CouponDto, CreateCouponDto, EventDto } from "@event-mgmt/shared-schemas";
import { apiSlice } from '../apiSlice';
import { addToast } from '../../../store/slices/ui';

export const couponsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getEventCoupons: builder.query<CouponDto[], string>({
      query: (eventId) => `/coupons/event/${eventId}`,
      providesTags: (result, error, eventId) =>
      result
        ? [
            ...result.map(({ id }) => ({ type: 'Coupon' as const, id })),
            { type: 'Coupon', id: `LIST_${eventId}` },
          ]
        : [{ type: 'Coupon', id: `LIST_${eventId}` }],
    }),
    createCoupon: builder.mutation<CouponDto, CreateCouponDto>({
      query: (coupon) => ({
        url: '/coupons',
        method: 'POST',
        body: coupon
      }),
      invalidatesTags: (result, error, { eventId }) => [
        { type: 'Coupon', id: `LIST_${eventId}` }
      ],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(addToast({ 
            message: 'Coupon created successfully!', type: 'success' 
          }));
        } catch (error: any) {
          dispatch(addToast({ 
            message: error.message || 'Failed to create coupon', type: 'error'
          }));
        }
      }
    }),
    updateCoupon: builder.mutation<CouponDto, Partial<CouponDto>>({
      query: ({ id, ...coupon }) => ({
        url: `/coupons/${id}`,
        method: 'PATCH',
        body: coupon
      }),
      // Notice: We DON'T invalidate the lists! 
      // Because the ID tag is shared, both lists will update their internal item automatically.
      invalidatesTags: (result, error, { eventId }) => [
        { type: 'Coupon', id: `LIST_${eventId}` }
      ],
      async onQueryStarted({ id, eventId, ...patch }, { dispatch, queryFulfilled }) {
        // Manually update the 'getEventCoupons' cache entry
        // Due to the immediacy we need from 'toggleCouponStatus' feature
        const patchResult = dispatch(
          couponsApi.util.updateQueryData('getEventCoupons', eventId!, (draft) => {
            const coupon = draft.find((c) => c.id === id);
            if (coupon) {
              Object.assign(coupon, patch);
            }
          })
        );
        try {
          await queryFulfilled;
          dispatch(addToast({ 
            message: 'Coupon updated successfully!', type: 'success' 
          }));
        } catch (error: any) {
          patchResult.undo();
          dispatch(addToast({ 
            message: error.message || 'Failed to update coupon', type: 'error'
          }));
        }
      },
    }),
    deleteCoupon: builder.mutation<void, { id: string, eventId: string}>({
      query: ({ id }) => ({
        url: `/coupons/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { eventId }) => [
        { type: 'Coupon', id: `LIST_${eventId}` },
      ],
    }),
  }),
})

export const { 
  useGetEventCouponsQuery,
  useCreateCouponMutation,
  useUpdateCouponMutation,
  useDeleteCouponMutation,
} = couponsApi;
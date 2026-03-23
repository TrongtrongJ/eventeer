import type { BookingDto, CreateBookingDto } from "@event-mgmt/shared-schemas";
import { apiSlice } from '../apiSlice';
import { addToast } from '../../../store/slices/ui';
export const bookingsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBookingById: builder.query<BookingDto, string>({
      query: (id) => ({
        url: `bookings/${id}`
      }),
      providesTags: (result, error, id) => [{ type: 'Booking', id }],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch(error: any) {
          dispatch(addToast({ 
            message: error.message 
              || 'Failed to fetch booking with specified id', type: 'error'
          }));
        }
      }
    }),
    getMyBookings: builder.query<BookingDto[], void>({
      query: () => '/bookings/me',
      providesTags: (result) => 
        result 
          ? [
              ...result.map(({ id }) => ({ type: 'Booking' as const, id })),
              { type: 'Booking', id: 'MY_LIST' } // Distinct list tag
            ]
          : [{ type: 'Booking', id: 'MY_LIST' }],
    }),
    createBooking: builder.mutation<BookingDto, CreateBookingDto>({
      query: (booking) => ({
        url: '/bookings/create',
        method: 'POST',
        body: booking
      }),
      invalidatesTags: (result) => [{ type: 'Booking', id: result?.id }, { type: 'Booking', id: 'MY_LIST' }],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(addToast({ 
            message: 'Booking created successfully!', type: 'success' 
          }));
        } catch (error: any) {
          console.error(error)
          dispatch(addToast({ 
            message: error.message || 'Failed to create booking', type: 'error'
          }));
        }
      }
    }),
    confirmBooking: builder.mutation<BookingDto, string>({
      query: (id) => ({
        url: `/bookings/${id}/confirm`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Booking', id }],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(addToast({ 
            message: 'Booking confirmed successfully!', type: 'success' 
          }));
        } catch(error: any) {
          dispatch(addToast({ 
            message: error.message || 'Failed to confirm booking', type: 'error'
          }));
        }
      }
    }),
    cancelBooking: builder.mutation<void, string>({
      query: (id) => ({
        url: `/bookings/${id}`,
        method: 'DELETE',
      }),
      // Burn the specific item AND the list
      invalidatesTags: (result, error, id) => [
        { type: 'Booking', id },
        { type: 'Booking', id: 'MY_LIST' },
      ],
    }),
  })
});

export const {
  useGetBookingByIdQuery,
  useGetMyBookingsQuery,
  useCreateBookingMutation,
  useConfirmBookingMutation,
  useCancelBookingMutation,
} = bookingsApi;
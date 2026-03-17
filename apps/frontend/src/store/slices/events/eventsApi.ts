import { CreateEventDto, EventDto } from "@event-mgmt/shared-schemas";
import { io } from 'socket.io-client';
import { SeatAvailabilityUpdate } from '@event-mgmt/shared-schemas';
import { webSocketUrl } from '@constants/config'
import { apiSlice } from '../apiSlice';
import { addToast } from '../../../store/slices/ui';

export const eventsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getEvents: builder.query<EventDto[], void>({
      query: () => '/events',
      providesTags: (result) =>
      result
        ? [
            ...result.map(({ id }) => ({ type: 'Event' as const, id })),
            { type: 'Event', id: 'LIST' },
          ]
        : [{ type: 'Event', id: 'LIST' }],
    }),
    getEventById: builder.query<EventDto, string>({
      query: (id) => `/events/${id}`,
      providesTags: (result, error, id) => [{ type: 'Event', id }],
      // This is where the magic happens
      async onCacheEntryAdded(eventId, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        // 1. Setup the socket connection
        const socket = io(webSocketUrl, { transports: ['websocket'] });

        try {
          // 2. Wait for the initial HTTP fetch to succeed
          await cacheDataLoaded;

          // 3. Subscribe to the specific event room
          socket.emit('subscribe:event', { eventId });

          // 4. Listen for seat updates and "patch" the cache directly
          socket.on('seat:update', (update: SeatAvailabilityUpdate) => {
            updateCachedData((draft) => {
              // If the IDs match, update the draft (Immer handles this safely)
              if (draft.id === update.eventId) {
                draft.availableSeats = update.availableSeats;
              }
            });
          });
        } catch {
          // If the initial fetch fails, we don't need to listen
        }

        // 5. Cleanup: When the component unmounts and the cache entry is removed,
        // the socket automatically disconnects.
        await cacheEntryRemoved;
        socket.emit('unsubscribe:event', { eventId });
        socket.close();
      },
    }),
    getMyEvents: builder.query<EventDto[], void>({
      query: () => '/events/me',
      providesTags: (result) => 
        result 
          ? [
              ...result.map(({ id }) => ({ type: 'Event' as const, id })),
              { type: 'Event', id: 'MY_LIST' } // Distinct list tag
            ]
          : [{ type: 'Event', id: 'MY_LIST' }],
    }),
    createEvent: builder.mutation<EventDto, CreateEventDto>({
      query: (event) => ({
        url: '/events',
        method: 'POST',
        body: event
      }),
      // Creating an event changes the length/content of both lists
      invalidatesTags: (result, error, event) => 
        result 
          ? [{ type: 'Event', id: result.id }, { type: 'Event', id: 'MY_LIST' }, { type: 'Event', id: 'LIST' }]
          : []
      ,
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(addToast({ 
            message: 'Event created successfully!', type: 'success' 
          }));
        } catch (error: any) {
          dispatch(addToast({ 
            message: error.message || 'Failed to create event', type: 'error'
          }));
        }
      }
    }),
    updateEvent: builder.mutation<EventDto, Partial<EventDto>>({
      query: ({ id, ...event }) => ({
        url: `/events/${id}`,
        method: 'PATCH',
        body: event
      }),
      // Notice: We DON'T invalidate the lists! 
      // Because the ID tag is shared, both lists will update their internal item automatically.
      invalidatesTags: (result, error, { id }) => [{ type: 'Event', id }],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(addToast({ 
            message: 'Event updated successfully!', type: 'success' 
          }));
        } catch(error: any) {
          dispatch(addToast({ 
            message: error.message || 'Failed to update event', type: 'error'
          }));
        }
      }
    }),
    deleteEvent: builder.mutation<void, string>({
      query: (id) => ({
        url: `/events/${id}`,
        method: 'DELETE',
      }),
      // Burn the specific item AND the list
      invalidatesTags: (result, error, id) => [
        { type: 'Event', id },
        { type: 'Event', id: 'LIST' },
      ],
    }),
  }),
})

export const { 
  useGetEventsQuery, 
  useGetEventByIdQuery,
  useGetMyEventsQuery,
  useCreateEventMutation,
  useUpdateEventMutation 
} = eventsApi;
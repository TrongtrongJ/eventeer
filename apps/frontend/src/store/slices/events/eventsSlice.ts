import { EventDto } from '@event-mgmt/shared-schemas';
import { createSlice, PayloadAction, Reducer, Slice } from '@reduxjs/toolkit';

export interface EventsState {
  selectedEventId: string | null;
  selectedEvent: EventDto | null;
}

const initialState: EventsState = {
  selectedEventId: null,
  selectedEvent: null,
};

export const eventsSlice: Slice<EventsState> = createSlice({
  name: 'events',
  initialState,
  reducers: {
    setSelectedEvent: (state, action: PayloadAction<EventDto | null>) => {
      state.selectedEvent = action.payload
      state.selectedEventId = action.payload?.id || null
    },
    clearSelectedEvent: (state) => {
      state.selectedEventId = null;
    }
  },
});

export const { setSelectedEvent, clearSelectedEvent } = eventsSlice.actions;
export default eventsSlice.reducer as Reducer<EventsState>;
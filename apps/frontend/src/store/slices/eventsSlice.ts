import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { EventDto } from "@event-mgmt/shared-schemas";
import { apiClient } from "../../api/client";

interface EventsState {
  events: EventDto[];
  selectedEvent: EventDto | null;
  loading: boolean;
  error: string | null;
}

const initialState: EventsState = {
  events: [],
  selectedEvent: null,
  loading: false,
  error: null,
};

export const fetchEvents = createAsyncThunk("events/fetchAll", async () => {
  const response = await apiClient.get("/events");
  return response.data.data;
});

export const fetchEventById = createAsyncThunk(
  "events/fetchById",
  async (id: string) => {
    const response = await apiClient.get(`/events/${id}`);
    return response.data.data;
  }
);

export const createEvent = createAsyncThunk(
  "events/create",
  async (event: any) => {
    const response = await apiClient.post("/events", event);
    return response.data.data;
  }
);

const eventsSlice = createSlice({
  name: "events",
  initialState,
  reducers: {
    updateEventSeats: (
      state,
      action: PayloadAction<{ eventId: string; availableSeats: number }>
    ) => {
      const event = state.events.find((e) => e.id === action.payload.eventId);
      if (event) {
        event.availableSeats = action.payload.availableSeats;
      }
      if (state.selectedEvent?.id === action.payload.eventId) {
        state.selectedEvent.availableSeats = action.payload.availableSeats;
      }
    },
    clearSelectedEvent: (state) => {
      state.selectedEvent = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEvents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.loading = false;
        state.events = action.payload;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch events";
      })
      .addCase(fetchEventById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEventById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedEvent = action.payload;
      })
      .addCase(fetchEventById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch event";
      })
      .addCase(createEvent.fulfilled, (state, action) => {
        state.events.push(action.payload);
      });
  },
});

export const { updateEventSeats, clearSelectedEvent } = eventsSlice.actions;
export default eventsSlice.reducer;

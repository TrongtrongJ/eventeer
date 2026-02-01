import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { BookingDto, CreateBookingDto } from "@event-mgmt/shared-schemas";
import { apiClient } from "../../api/client";

interface BookingsState {
  currentBooking: (BookingDto & { clientSecret?: string }) | null;
  bookings: BookingDto[];
  loading: boolean;
  error: string | null;
}

const initialState: BookingsState = {
  currentBooking: null,
  bookings: [],
  loading: false,
  error: null,
};

export const createBooking = createAsyncThunk(
  "bookings/create",
  async (booking: CreateBookingDto) => {
    const response = await apiClient.post("/bookings", booking);
    return response.data.data;
  }
);

export const confirmBooking = createAsyncThunk(
  "bookings/confirm",
  async (bookingId: string) => {
    const response = await apiClient.post(`/bookings/${bookingId}/confirm`);
    return response.data.data;
  }
);

export const fetchBooking = createAsyncThunk(
  "bookings/fetchById",
  async (bookingId: string) => {
    const response = await apiClient.get(`/bookings/${bookingId}`);
    return response.data.data;
  }
);

const bookingsSlice = createSlice({
  name: "bookings",
  initialState,
  reducers: {
    clearCurrentBooking: (state) => {
      state.currentBooking = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createBooking.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.loading = false;
        state.currentBooking = action.payload;
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to create booking";
      })
      .addCase(confirmBooking.fulfilled, (state, action) => {
        state.currentBooking = action.payload;
      })
      .addCase(fetchBooking.fulfilled, (state, action) => {
        state.currentBooking = action.payload;
      });
  },
});

export const { clearCurrentBooking } = bookingsSlice.actions;
export default bookingsSlice.reducer;

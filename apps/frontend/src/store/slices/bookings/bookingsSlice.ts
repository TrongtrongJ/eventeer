import { createSlice, Reducer } from "@reduxjs/toolkit";
import { BookingDto } from "@event-mgmt/shared-schemas";
export interface BookingsState {
  currentBooking: (BookingDto & { clientSecret?: string }) | null;
}

const initialState: BookingsState = {
  currentBooking: null,
};
const bookingsSlice = createSlice({
  name: "bookings",
  initialState,
  reducers: {
    clearCurrentBooking: (state) => {
      state.currentBooking = null;
    },
  },
});
export const { clearCurrentBooking } = bookingsSlice.actions;
export default bookingsSlice.reducer as Reducer<BookingsState>;
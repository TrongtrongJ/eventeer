import { createSlice, PayloadAction, Reducer, Slice } from '@reduxjs/toolkit';

export interface CouponsState {
  selectedCouponId: string | null;
}

const initialState: CouponsState = {
  selectedCouponId: null
};

export const couponsSlice: Slice<CouponsState> = createSlice({
  name: 'coupons',
  initialState,
  reducers: {
    setSelectedCouponId: (state, action: PayloadAction<string | null>) => {
      state.selectedCouponId = action.payload
    },
    clearSelectedCouponId: (state) => {
      state.selectedCouponId = null;
    }
  },
});

export const { setSelectedCouponId, clearSelectedCouponId } = couponsSlice.actions;
export default couponsSlice.reducer as Reducer<CouponsState>;
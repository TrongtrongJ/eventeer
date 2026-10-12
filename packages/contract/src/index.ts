import { authContract } from "./auth.contract";
import { bookingContract } from "./booking.contract";
import { couponContract } from "./coupon.contract";
import { eventContract } from "./event.contract";
import { ticketContract } from "./ticket.contract";

export {
  authContract,
  bookingContract,
  couponContract,
  eventContract,
  ticketContract,
};
export const baseContract = {
  auth: authContract,
  booking: bookingContract,
  coupon: couponContract,
  event: eventContract,
  ticket: ticketContract,
} as const;
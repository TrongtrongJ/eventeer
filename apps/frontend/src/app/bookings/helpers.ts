import type { BookingStatus } from "@packages/shared-schemas";
import type { Formatter } from "@/i18n/types";

const bookingStatusClassMap = new Map<BookingStatus, string>([
    ["CONFIRMED", "bg-green-100 text-green-800"],
    ["PENDING", "bg-yellow-100 text-yellow-800"],
    ["CANCELLED", "bg-red-100 text-red-800"],
]);

export function getBookingStatusClass(status: BookingStatus) {
    return bookingStatusClassMap.get(status) || "";
}

export function formatBookingDate(format: Formatter, date: Date | string) {
    return format.dateTime(new Date(date), { dateStyle: "medium" });
}

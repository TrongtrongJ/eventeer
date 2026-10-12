import type { BookingStatus } from "@packages/shared-schemas";
import type { Formatter } from "@/i18n/types";

const bookingStatusClassMap = new Map<BookingStatus, string>([
    ["CONFIRMED", "text-success"],
    ["PENDING", "text-warning"],
    ["CANCELLED", "text-muted-foreground"],
]);

export function getBookingStatusClass(status: BookingStatus) {
    return bookingStatusClassMap.get(status) || "text-muted-foreground";
}

export function formatBookingDate(format: Formatter, date: Date | string) {
    return format.dateTime(new Date(date), { dateStyle: "medium" });
}

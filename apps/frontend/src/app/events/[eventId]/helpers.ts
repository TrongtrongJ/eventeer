import type { Formatter } from "@/i18n/types";

export function formatEventDate(format: Formatter, dateString?: string) {
    if (!dateString) return "";
    return format.dateTime(new Date(dateString), { dateStyle: "medium", timeStyle: "short" });
}

/** 0 = sold out, 1 = nothing sold yet. */
export function seatsRemainingRatio(availableSeats: number, capacity: number) {
    if (capacity <= 0) return 0;
    return Math.min(1, Math.max(0, availableSeats / capacity));
}

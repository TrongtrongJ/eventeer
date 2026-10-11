import type { Formatter } from "@/i18n/types";

export function formatEventDate(format: Formatter, dateString?: string) {
    if (!dateString) return "";
    return format.dateTime(new Date(dateString), { dateStyle: "medium", timeStyle: "short" });
}

import type { Formatter } from "@/i18n/types";

export function getCouponsUsagePercentage(current: number, max: number) {
    return Math.round((current / max) * 100);
}

export function getCouponsUsagePercentageClass(current: number, max: number) {
    const usagePercentage = getCouponsUsagePercentage(current, max);
    if (usagePercentage >= 100) return "bg-destructive";
    if (usagePercentage >= 80) return "bg-warning";
    return "bg-success";
}

export function getCouponExpirationDateClass(expiresAt: Date | string) {
    return new Date(expiresAt) < new Date() ? "text-destructive" : "";
}

export function formatExpirationDate(format: Formatter, expiresAt: Date | string) {
    return format.dateTime(new Date(expiresAt), { dateStyle: "medium" });
}

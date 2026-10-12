"use client";

import Link from "next/link";
import { TicketPercent } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CouponDto } from "@packages/shared-schemas";
import { Button } from "@/components/ui/button";
import { Empty, EmptyActions, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EventCouponItem } from "./EventCouponItem";

interface EventCouponsPanelProps {
    coupons?: CouponDto[];
    eventId: string;
    currency?: string;
}

export function EventCouponsPanel({ coupons, eventId, currency }: EventCouponsPanelProps) {
    const t = useTranslations("Coupons");
    const isCouponsListEmpty = !coupons || coupons.length === 0;

    if (isCouponsListEmpty) {
        return (
            <Empty>
                <EmptyMedia>
                    <TicketPercent />
                </EmptyMedia>
                <EmptyHeader>
                    <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                    <EmptyDescription>{t("emptyBody")}</EmptyDescription>
                </EmptyHeader>
                <EmptyActions>
                    <Button asChild size="sm">
                        <Link href={`/events/${eventId}/coupons/create`}>{t("createFirst")}</Link>
                    </Button>
                </EmptyActions>
            </Empty>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">
                    <TableHead>{t("colCode")}</TableHead>
                    <TableHead>{t("colDiscount")}</TableHead>
                    <TableHead className="hidden w-52 sm:table-cell">{t("colUsage")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("colExpires")}</TableHead>
                    <TableHead className="w-px">
                        <span className="sr-only">{t("colStatus")}</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {coupons.map(coupon => (
                    <EventCouponItem key={coupon.id} coupon={coupon} currency={currency} />
                ))}
            </TableBody>
        </Table>
    );
}

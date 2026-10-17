"use client";

import { useMoney } from "@/i18n/hooks";
import { type NamespaceKeys, useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronRight, Ticket, TriangleAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import { getBookingStatusClass, formatBookingDate } from "./helpers";
import EmptyList from "@/components/EmptyList";
import { TableSkeleton, bookingsColumns } from "@/components/Loader/PageSkeletons";
import { BookingStatusIcon } from "@/components/StatusIcons";
import { PageHeader } from "@/components/shell/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type BookingStatusMessageKey = NamespaceKeys<"Enums", "bookingStatus">;

export function MyBookingsClient() {
    const t = useTranslations("Bookings");
    const tc = useTranslations("Common");
    const tStatus = useTranslations("Enums.bookingStatus");
    const formatMoney = useMoney();
    const format = useFormatter();
    const { data, isLoading, isError, error } = useQuery(orpc.bookings.getMyBookings.queryOptions());
    const bookings = data?.data;

    const header = <PageHeader title={t("title")} />;

    if (isLoading) {
        return (
            <>
                {header}
                <TableSkeleton columns={bookingsColumns} rows={6} />
            </>
        );
    }

    if (isError) {
        return (
            <>
                {header}
                <div className="p-4">
                    <Alert variant="destructive">
                        <TriangleAlert />
                        <AlertDescription>{(error as any)?.message || tc("somethingWrong")}</AlertDescription>
                    </Alert>
                </div>
            </>
        );
    }

    if (!bookings || bookings.length === 0) {
        return (
            <>
                {header}
                <EmptyList
                    icon={<Ticket />}
                    message={t("empty")}
                    action={
                        <Button asChild size="sm">
                            <Link href="/">{t("browse")}</Link>
                        </Button>
                    }
                />
            </>
        );
    }

    return (
        <>
            {header}
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead>{t("colBooking")}</TableHead>
                        <TableHead>{t("colStatus")}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t("colTickets")}</TableHead>
                        <TableHead className="text-right">{t("colTotal")}</TableHead>
                        <TableHead className="hidden text-right md:table-cell">{t("colDate")}</TableHead>
                        <TableHead className="w-10 max-sm:hidden">
                            <span className="sr-only">{t("viewDetails")}</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {bookings.map(booking => (
                        <TableRow key={booking.id} className="group relative">
                            <TableCell className="font-medium whitespace-normal">
                                {/* The first cell's link stretches over the whole row, so the row is one big target. */}
                                <Link
                                    href={`/booking/${booking.id}`}
                                    className="font-mono text-[13px] outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                                >
                                    {t("bookingNumber", { id: booking.id.slice(0, 8) })}
                                </Link>
                            </TableCell>
                            <TableCell>
                                <span
                                    className={cn(
                                        "inline-flex items-center gap-2",
                                        getBookingStatusClass(booking.status),
                                    )}
                                >
                                    <BookingStatusIcon status={booking.status} />
                                    <span className="text-foreground">
                                        {tStatus(booking.status as BookingStatusMessageKey)}
                                    </span>
                                </span>
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                                {tc("ticketCount", { count: booking.quantity })}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                                {formatMoney(booking.finalAmount, booking.currency)}
                            </TableCell>
                            <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                                {formatBookingDate(format, booking.createdAt)}
                            </TableCell>
                            <TableCell className="max-sm:hidden">
                                <ChevronRight
                                    aria-hidden="true"
                                    className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    );
}

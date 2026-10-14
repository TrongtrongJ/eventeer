"use client";

import { useMoney } from "@/i18n/hooks";
import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { CalendarCheck, Plus, TicketPercent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import EmptyList from "@/components/EmptyList";
import { TableSkeleton, myEventsColumns } from "@/components/Loader/PageSkeletons";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { seatsRemainingRatio } from "../events/[eventId]/helpers";

export function MyEventsClient() {
    const t = useTranslations("MyEvents");
    const tEvents = useTranslations("EventsList");
    const formatMoney = useMoney();
    const format = useFormatter();
    const { data, isLoading } = useQuery(orpc.events.getMyEvents.queryOptions());
    const events = data?.data;

    const createButton = (
        <Button asChild size="sm">
            <Link href="/create">
                <Plus />
                {t("createEvent")}
            </Link>
        </Button>
    );

    if (isLoading) {
        return (
            <>
                <PageHeader title={t("title")} />
                <TableSkeleton columns={myEventsColumns} rows={5} />
            </>
        );
    }

    if (!events || events.length === 0) {
        return (
            <>
                <PageHeader title={t("title")} />
                <EmptyList icon={<CalendarCheck />} message={t("empty")} action={createButton} />
            </>
        );
    }

    return (
        <>
            <PageHeader
                title={t("title")}
                meta={
                    <Badge variant="outline" className="ml-1 tabular-nums">
                        {tEvents("count", { count: events.length })}
                    </Badge>
                }
                actions={createButton}
            />

            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead>{t("colEvent")}</TableHead>
                        <TableHead className="hidden md:table-cell">{t("colDate")}</TableHead>
                        <TableHead className="hidden w-48 sm:table-cell">{t("colSeats")}</TableHead>
                        <TableHead className="hidden text-right lg:table-cell">{t("colPrice")}</TableHead>
                        <TableHead className="w-px" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map(event => {
                        const sold = event.capacity - event.availableSeats;
                        const soldRatio = 1 - seatsRemainingRatio(event.availableSeats, event.capacity);
                        return (
                            <TableRow key={event.id}>
                                <TableCell className="max-w-72 whitespace-normal">
                                    <Link
                                        href={`/events/${event.id}`}
                                        className="block truncate font-medium outline-none hover:underline focus-visible:underline"
                                    >
                                        {event.title}
                                    </Link>
                                    <span className="block truncate text-xs text-muted-foreground">{event.location}</span>
                                </TableCell>
                                <TableCell className="hidden text-muted-foreground md:table-cell">
                                    {format.dateTime(new Date(event.startDate), { dateStyle: "medium" })}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                    <div className="flex items-center gap-2.5">
                                        <Progress
                                            value={soldRatio * 100}
                                            aria-label={t("colSeats")}
                                            className="w-24"
                                            indicatorClassName={cn(soldRatio >= 1 ? "bg-destructive" : "bg-primary")}
                                        />
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                            {sold} / {event.capacity}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden text-right font-medium tabular-nums lg:table-cell">
                                    {formatMoney(event.ticketPrice, event.currency)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-end gap-1.5">
                                        <Button asChild variant="ghost" size="sm">
                                            <Link href={`/events/${event.id}`}>{t("view")}</Link>
                                        </Button>
                                        <Button asChild variant="outline" size="sm">
                                            <Link href={`/events/${event.id}/coupons`}>
                                                <TicketPercent />
                                                {t("coupons")}
                                            </Link>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </>
    );
}

"use client";

import { useMoney } from "@/i18n/hooks";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus, TriangleAlert } from "lucide-react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/query";
import type { eventsClient } from "@/lib/orpc/browser-client";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import EmptyList from "@/components/EmptyList";
import { ListSkeleton } from "@/components/Loader/ListSkeleton";
import { ProgressRing } from "@/components/StatusIcons";
import { PageHeader } from "@/components/shell/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { seatsRemainingRatio } from "./events/[eventId]/helpers";

type EventsFindAllData = Awaited<ReturnType<typeof eventsClient.findAll>>;
type EventRow = NonNullable<EventsFindAllData["data"]>[number];

interface EventsListClientProps {
    initialData?: EventsFindAllData;
    pageSize: number;
}

export function EventsListClient({ initialData, pageSize }: EventsListClientProps) {
    const t = useTranslations("EventsList");
    const tc = useTranslations("Common");
    const tNav = useTranslations("Nav");
    const formatMoney = useMoney();
    const format = useFormatter();
    const { user } = useSession();
    const [page, setPage] = useState(1);

    const { data, isLoading, isFetching, isError, error } = useQuery({
        ...orpc.events.findAll.queryOptions({
            input: { pagination: { page, limit: pageSize } },
        }),
        initialData: page === 1 ? initialData : undefined,
        placeholderData: keepPreviousData,
    });

    const events: EventRow[] = data?.data ?? [];
    const canCreate = user?.role === "ORGANIZER" || user?.role === "ADMIN";

    // Group by month, in the order the API returned them (it already sorts by start date).
    const groups = new Map<string, { label: string; events: EventRow[] }>();
    for (const event of events) {
        const start = new Date(event.startDate);
        const key = `${start.getFullYear()}-${start.getMonth()}`;
        const group = groups.get(key) ?? {
            label: format.dateTime(start, { month: "long", year: "numeric" }),
            events: [],
        };
        group.events.push(event);
        groups.set(key, group);
    }

    const header = (
        <PageHeader
            title={t("title")}
            meta={
                // Only a single page's worth is known client-side, so a count is shown when it is the whole list.
                events.length > 0 && !data?.meta?.hasNextPage && !data?.meta?.hasPreviousPage ? (
                    <Badge variant="outline" className="ml-1 tabular-nums">
                        {t("count", { count: events.length })}
                    </Badge>
                ) : undefined
            }
            actions={
                canCreate && (
                    <Button asChild size="sm">
                        <Link href="/create">
                            <Plus />
                            {tNav("createEvent")}
                        </Link>
                    </Button>
                )
            }
        />
    );

    if (isLoading) {
        return (
            <>
                {header}
                <ListSkeleton rows={8} />
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

    if (events.length === 0) {
        return (
            <>
                {header}
                <EmptyList
                    message={t("empty")}
                    icon={<CalendarDays />}
                    action={
                        canCreate ? (
                            <Button asChild size="sm">
                                <Link href="/create">
                                    <Plus />
                                    {tNav("createEvent")}
                                </Link>
                            </Button>
                        ) : undefined
                    }
                />
            </>
        );
    }

    return (
        <>
            {header}

            <div className={cn("transition-opacity", isFetching && "opacity-60")}>
                {[...groups.entries()].map(([key, group]) => (
                    <section key={key} aria-label={group.label}>
                        <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                            <span className="text-foreground/80">{group.label}</span>
                            <span className="tabular-nums">{group.events.length}</span>
                        </div>
                        <ul className="divide-y">
                            {group.events.map(event => {
                                const soldOut = event.availableSeats <= 0;
                                const ratio = seatsRemainingRatio(event.availableSeats, event.capacity);
                                const lowStock = !soldOut && ratio <= 0.15;
                                return (
                                    <li key={event.id}>
                                        <Link
                                            href={`/events/${event.id}`}
                                            className="group flex items-center gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset"
                                        >
                                            <ProgressRing
                                                value={ratio}
                                                className={cn(
                                                    "text-muted-foreground",
                                                    soldOut && "text-destructive",
                                                    lowStock && "text-warning",
                                                    !soldOut && !lowStock && "text-success",
                                                )}
                                            />

                                            {event.imageUrl && (
                                                <img
                                                    src={event.imageUrl}
                                                    alt=""
                                                    className="hidden size-9 shrink-0 rounded-md border object-cover sm:block"
                                                />
                                            )}

                                            <div className="min-w-0 flex-1">
                                                <h2 className="truncate text-sm font-medium text-foreground">{event.title}</h2>
                                                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                    <MapPin className="size-3 shrink-0" />
                                                    <span className="truncate">{event.location}</span>
                                                </p>
                                                <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                                                    {format.dateTime(new Date(event.startDate), {
                                                        month: "short",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                            </div>

                                            <div className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:block">
                                                {format.dateTime(new Date(event.startDate), {
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </div>

                                            <div className="hidden w-28 shrink-0 justify-end md:flex">
                                                {soldOut ? (
                                                    <Badge variant="destructive">{t("soldOut")}</Badge>
                                                ) : (
                                                    <span
                                                        className={cn(
                                                            "text-xs tabular-nums",
                                                            lowStock ? "text-warning" : "text-muted-foreground",
                                                        )}
                                                    >
                                                        {t("seatsLeft", { count: event.availableSeats })}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="w-20 shrink-0 text-right text-sm font-medium tabular-nums">
                                                {formatMoney(event.ticketPrice, event.currency)}
                                            </div>

                                            <ChevronRight
                                                aria-hidden="true"
                                                className="hidden size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground lg:block"
                                            />
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
            </div>

            {data?.meta && (data.meta.hasPreviousPage || data.meta.hasNextPage) && (
                <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {t("pageOf", { page: data.meta.page, total: data.meta.totalPages })}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={!data.meta.hasPreviousPage}
                        >
                            <ChevronLeft />
                            {t("previous")}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => p + 1)}
                            disabled={!data.meta.hasNextPage}
                        >
                            {t("next")}
                            <ChevronRight />
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}

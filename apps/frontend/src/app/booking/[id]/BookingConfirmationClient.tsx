"use client";

import { useMoney } from "@/i18n/hooks";
import { useTranslations, type NamespaceKeys } from "next-intl";
import Link from "next/link";
import { Check, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "react-qr-code";
import { orpc } from "@/lib/orpc/query";
import { cn } from "@/lib/utils";
import { BookingConfirmationSkeleton } from "@/components/Loader/PageSkeletons";
import { BookingStatusIcon } from "@/components/StatusIcons";
import { PageContent, PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type BookingStatusMessageKey = NamespaceKeys<"Enums", "bookingStatus">;

function Detail({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("space-y-1", className)}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium break-all">{children}</dd>
        </div>
    );
}

export function BookingConfirmationClient({ bookingId }: { bookingId: string }) {
    const t = useTranslations("BookingConfirmation");
    const tNav = useTranslations("Nav");
    const tBookings = useTranslations("Bookings");
    const tStatus = useTranslations("Enums.bookingStatus");
    const formatMoney = useMoney();
    const { data, isLoading } = useQuery(orpc.bookings.findOne.queryOptions({ input: { id: bookingId } }));
    const currentBooking = data?.data;

    if (isLoading || !currentBooking) {
        return (
            <>
                <PageHeader
                    crumbs={[{ label: tNav("myBookings"), href: "/bookings" }]}
                    title={`#${bookingId.slice(0, 8)}`}
                    titleAsText
                />
                <BookingConfirmationSkeleton />
            </>
        );
    }

    return (
        <>
            <PageHeader
                crumbs={[{ label: tNav("myBookings"), href: "/bookings" }]}
                title={tBookings("bookingNumber", { id: currentBooking.id.slice(0, 8) })}
                titleAsText
                actions={
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer />
                        {t("print")}
                    </Button>
                }
            />

            <PageContent width="default" className="space-y-8">
                <div className="flex items-start gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                        <Check className="size-5" strokeWidth={2.5} />
                    </span>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
                        <p className="text-sm text-muted-foreground">{t("sentTo", { email: currentBooking.email })}</p>
                    </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border bg-card p-4 sm:grid-cols-3">
                    <Detail label={t("bookingId")} className="col-span-2 sm:col-span-3">
                        <span className="font-mono text-xs">{currentBooking.id}</span>
                    </Detail>
                    <Detail label={t("status")}>
                        <span className="inline-flex items-center gap-1.5">
                            <BookingStatusIcon status={currentBooking.status} />
                            {tStatus(currentBooking.status as BookingStatusMessageKey)}
                        </span>
                    </Detail>
                    <Detail label={t("name")}>
                        {currentBooking.firstName} {currentBooking.lastName}
                    </Detail>
                    <Detail label={t("tickets")}>{currentBooking.quantity}</Detail>
                    <Detail label={t("totalPaid")}>
                        <span className="tabular-nums">
                            {formatMoney(currentBooking.finalAmount, currentBooking.currency)}
                        </span>
                    </Detail>
                </dl>

                <section className="space-y-4">
                    <h2 className="text-base font-semibold tracking-tight">{t("yourTickets")}</h2>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {currentBooking.tickets?.map((ticket, index) => (
                            <Card key={ticket.id} className="gap-0 overflow-hidden py-0 break-inside-avoid">
                                <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-medium">
                                            {t("ticketNumber", { number: index + 1 })}
                                        </h3>
                                        <p className="truncate font-mono text-xs text-muted-foreground">
                                            {ticket.ticketNumber}
                                        </p>
                                    </div>
                                    {ticket.isValidated && <Badge variant="destructive">{t("used")}</Badge>}
                                </CardContent>

                                {/* Perforation: notches + dashed rule, like a torn ticket stub. */}
                                <div className="relative h-0 border-t border-dashed">
                                    <span className="absolute -top-2 -left-2 size-4 rounded-full border bg-background" />
                                    <span className="absolute -top-2 -right-2 size-4 rounded-full border bg-background" />
                                </div>

                                <CardContent className="flex flex-col items-center gap-3 px-4 py-5">
                                    <div className={cn("rounded-lg bg-white p-3", ticket.isValidated && "opacity-40")}>
                                        <QRCode value={ticket.qrCode} size={176} />
                                    </div>
                                    <p className="text-center text-xs text-muted-foreground">{t("presentQr")}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <div className="print:hidden">
                    <Button asChild variant="outline">
                        <Link href="/">{t("browseMore")}</Link>
                    </Button>
                </div>
            </PageContent>
        </>
    );
}

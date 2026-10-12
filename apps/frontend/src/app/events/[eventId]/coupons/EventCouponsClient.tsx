"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/query";
import SpinnerLoader from "@/components/Loader/SpinnerLoader";
import EmptyList from "@/components/EmptyList";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { EventCouponsPanel } from "./EventCouponsPanel";

export function EventCouponsClient({ eventId }: { eventId: string }) {
    const t = useTranslations("Coupons");
    const tNav = useTranslations("Nav");
    const {
        data: eventData,
        isLoading: isEventLoading,
        isError: isEventError,
    } = useQuery(orpc.events.findOne.queryOptions({ input: { id: eventId } }));

    const { data: couponsData } = useQuery(orpc.coupons.getEventCoupons.queryOptions({ input: { eventId } }));

    const event = eventData?.data;
    const coupons = couponsData?.data;

    if (isEventLoading) {
        return <SpinnerLoader />;
    }

    if (isEventError || !event) {
        return <EmptyList message={t("eventNotFound")} />;
    }

    return (
        <>
            <PageHeader
                crumbs={[
                    { label: tNav("myEvents"), href: "/my-events" },
                    { label: event.title, href: `/events/${eventId}` },
                ]}
                title={t("title")}
                actions={
                    <Button asChild size="sm">
                        <Link href={`/events/${eventId}/coupons/create`}>
                            <Plus />
                            {t("createCoupon")}
                        </Link>
                    </Button>
                }
            />

            <EventCouponsPanel eventId={eventId} coupons={coupons} currency={event.currency} />
        </>
    );
}

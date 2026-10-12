"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc/query";
import SpinnerLoader from "@/components/Loader/SpinnerLoader";
import EmptyList from "@/components/EmptyList";
import { EventCouponsPanel } from "./EventCouponsPanel";

export function EventCouponsClient({ eventId }: { eventId: string }) {
    const t = useTranslations("Coupons");
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
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="mb-6">
                <Link
                    href={`/events/${eventId}`}
                    className="text-indigo-600 hover:text-indigo-800 flex items-center mb-4"
                >
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t("backToEvent")}
                </Link>

                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("title")}</h1>
                        <p className="text-gray-600">{t("forEvent", { title: event.title })}</p>
                    </div>

                    <Link
                        href={`/events/${eventId}/coupons/create`}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 font-semibold"
                    >
                        {t("createCoupon")}
                    </Link>
                </div>
            </div>

            <EventCouponsPanel eventId={eventId} coupons={coupons} currency={event.currency} />
        </div>
    );
}

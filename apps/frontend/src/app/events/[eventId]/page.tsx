import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createServerOrpc } from "@/lib/orpc/server-client";
import { getSession } from "@/lib/auth/session";
import { EventDetailsClient } from "./EventDetailsClient";

interface EventDetailsPageProps {
    params: Promise<{ eventId: string }>;
}

async function EventDetailsInnerWrapper({ params }: EventDetailsPageProps) {
    const { eventId } = await params;
    const orpc = createServerOrpc();
    const session = await getSession();

    let event;
    try {
        const response = await orpc.events.findOne({ id: eventId });
        event = response.data;
    } catch {
        notFound();
    }

    return <EventDetailsClient event={event} isAuthenticated={session.isAuthenticated} user={session.user} />;
}

export default async function EventDetailsPage({ params }: EventDetailsPageProps) {
    return (
        <Suspense>
            <EventDetailsInnerWrapper params={params} />
        </Suspense>
    );
}

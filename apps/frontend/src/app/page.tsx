import { Suspense } from "react";
import { createServerOrpc } from "@/lib/orpc/server-client";
import { EventsListClient } from "./EventsListClient";

const PAGE_SIZE = 12;

async function EventsListPage() {
    const orpc = createServerOrpc();

    let initialData;
    try {
        initialData = await orpc.events.findAll({ pagination: { page: 1, limit: PAGE_SIZE } });
    } catch {
        initialData = undefined;
    }

    return <EventsListClient initialData={initialData} pageSize={PAGE_SIZE} />;
}
export default async function EventsListPageWrapper() {
    return (
        <Suspense>
            <EventsListPage />
        </Suspense>
    );
}

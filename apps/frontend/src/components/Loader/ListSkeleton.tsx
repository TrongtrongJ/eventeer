import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the events list: a month header, then rows of ring / title + place / date / seats / price. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
    const firstGroup = Math.ceil(rows / 2);
    return (
        <div aria-busy="true" role="status">
            {[firstGroup, rows - firstGroup].map((count, group) =>
                count > 0 ? (
                    <div key={group}>
                        <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-2">
                            <Skeleton className="h-3 w-24" />
                        </div>
                        <div className="divide-y">
                            {Array.from({ length: count }, (_, i) => (
                                <div key={i} className="flex items-center gap-3 px-4 py-3">
                                    <Skeleton className="size-4 shrink-0 rounded-full" />
                                    <div className="min-w-0 flex-1 space-y-1.5">
                                        <Skeleton className="h-3.5 w-2/5 max-w-64" />
                                        <Skeleton className="h-3 w-1/4 max-w-40" />
                                    </div>
                                    <Skeleton className="hidden h-3 w-24 sm:block" />
                                    <Skeleton className="hidden h-3 w-20 md:block" />
                                    <Skeleton className="h-3.5 w-16" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null,
            )}
        </div>
    );
}

import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder rows shown while a list query loads: keeps the layout from jumping. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <div aria-busy="true" className="divide-y">
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="size-4 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-1/3" />
                        <Skeleton className="h-3 w-1/5" />
                    </div>
                    <Skeleton className="hidden h-3.5 w-16 sm:block" />
                    <Skeleton className="h-3.5 w-14" />
                </div>
            ))}
        </div>
    );
}

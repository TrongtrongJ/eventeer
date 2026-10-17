import * as React from "react";

import { cn } from "@/lib/utils";

/** The shape of every empty / error / not-found state: an icon tile, a title, one sentence, one action. */
function Empty({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty"
            className={cn("flex flex-col items-center justify-center gap-4 px-6 py-16 text-center", className)}
            {...props}
        />
    );
}

function EmptyMedia({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-media"
            className={cn(
                "flex size-10 items-center justify-center rounded-lg border bg-card text-muted-foreground shadow-xs [&_svg:not([class*='size-'])]:size-5",
                className,
            )}
            {...props}
        />
    );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-header"
            className={cn("flex max-w-sm flex-col items-center gap-1", className)}
            {...props}
        />
    );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h2">) {
    return <h2 data-slot="empty-title" className={cn("text-base font-medium tracking-tight", className)} {...props} />;
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
    return <p data-slot="empty-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function EmptyActions({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="empty-actions" className={cn("flex items-center gap-2", className)} {...props} />;
}

export { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription, EmptyActions };

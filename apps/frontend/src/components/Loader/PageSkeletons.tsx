import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageContent } from "@/components/shell/PageHeader";
import { cn } from "@/lib/utils";

/**
 * Page-shaped loading placeholders. Each one copies the layout of the screen it stands in for
 * (same grid, same card/table structure), so content replaces it without the page jumping.
 * They are built from shadcn's <Skeleton>; no extra library is needed.
 */

export interface SkeletonColumn {
    /** Width of the placeholder bar, e.g. "w-24". */
    bar: string;
    /** Responsive visibility, mirroring the real column, e.g. "hidden md:table-cell". */
    className?: string;
    align?: "right";
    /** Optional leading circle (status icon). */
    icon?: boolean;
    /** A second, shorter line under the first (title + subtitle cells). */
    subline?: string;
}

/** A real <Table> frame with placeholder cells, matching the column layout of bookings / events / coupons. */
export function TableSkeleton({ columns, rows = 5 }: { columns: SkeletonColumn[]; rows?: number }) {
    return (
        <div aria-busy="true" role="status">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        {columns.map((col, i) => (
                            <TableHead key={i} className={cn(col.className, col.align === "right" && "text-right")}>
                                <Skeleton className={cn("h-3 w-14", col.align === "right" && "ml-auto")} />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: rows }, (_, r) => (
                        <TableRow key={r} className="hover:bg-transparent">
                            {columns.map((col, c) => (
                                <TableCell key={c} className={cn(col.className, "py-3")}>
                                    <div
                                        className={cn(
                                            "flex items-center gap-2",
                                            col.align === "right" && "justify-end",
                                        )}
                                    >
                                        {col.icon && <Skeleton className="size-4 shrink-0 rounded-full" />}
                                        <div className="space-y-1.5">
                                            <Skeleton className={cn("h-3.5", col.bar)} />
                                            {col.subline && <Skeleton className={cn("h-3", col.subline)} />}
                                        </div>
                                    </div>
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export const bookingsColumns: SkeletonColumn[] = [
    { bar: "w-24" },
    { bar: "w-20", icon: true },
    { bar: "w-16", className: "hidden sm:table-cell" },
    { bar: "w-16", align: "right" },
    { bar: "w-20", align: "right", className: "hidden md:table-cell" },
    { bar: "w-4" },
];

export const myEventsColumns: SkeletonColumn[] = [
    { bar: "w-44", subline: "w-28" },
    { bar: "w-20", className: "hidden md:table-cell" },
    { bar: "w-32", className: "hidden sm:table-cell" },
    { bar: "w-14", align: "right", className: "hidden xl:table-cell" },
    { bar: "w-28", align: "right" },
];

export const couponsColumns: SkeletonColumn[] = [
    { bar: "w-24" },
    { bar: "w-20", subline: "w-16" },
    { bar: "w-32", className: "hidden sm:table-cell" },
    { bar: "w-20", className: "hidden md:table-cell" },
    { bar: "w-8" },
];

/** Booking confirmation: status headline, details grid, then two ticket cards with a QR block. */
export function BookingConfirmationSkeleton() {
    return (
        <PageContent width="default" className="space-y-8">
            <div aria-busy="true" role="status" className="space-y-8">
                <div className="flex items-start gap-4">
                    <Skeleton className="size-10 shrink-0 rounded-full" />
                    <div className="space-y-2 pt-1">
                        <Skeleton className="h-6 w-56" />
                        <Skeleton className="h-3.5 w-72 max-w-full" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-lg border bg-card p-4 sm:grid-cols-3">
                    {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className={cn("space-y-1.5", i === 0 && "col-span-2 sm:col-span-3")}>
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className={cn("h-4", i === 0 ? "w-80 max-w-full" : "w-24")} />
                        </div>
                    ))}
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-5 w-32" />
                    <div className="grid gap-4 sm:grid-cols-2">
                        {[0, 1].map(i => (
                            <Card key={i} className="gap-0 py-0">
                                <CardContent className="space-y-1.5 px-4 py-3">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-3 w-36" />
                                </CardContent>
                                <div className="border-t border-dashed" />
                                <CardContent className="flex flex-col items-center gap-3 px-4 py-5">
                                    <Skeleton className="size-[200px] rounded-lg" />
                                    <Skeleton className="h-3 w-48" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </PageContent>
    );
}

/** Checkout: seat-hold notice + payment card on the left, order summary on the right. */
export function CheckoutSkeleton() {
    return (
        <PageContent width="wide">
            <div aria-busy="true" role="status" className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Card className="gap-4">
                        <CardHeader>
                            <Skeleton className="h-4 w-32" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Skeleton className="h-9 w-full" />
                            <div className="grid grid-cols-2 gap-3">
                                <Skeleton className="h-9" />
                                <Skeleton className="h-9" />
                            </div>
                        </CardContent>
                    </Card>
                    <Skeleton className="h-9 w-full" />
                </div>
                <Card className="h-fit gap-0 py-0">
                    <CardHeader className="border-b py-3">
                        <Skeleton className="h-3 w-24" />
                    </CardHeader>
                    <CardContent className="space-y-3 py-4">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="flex justify-between">
                                <Skeleton className="h-3.5 w-20" />
                                <Skeleton className="h-3.5 w-16" />
                            </div>
                        ))}
                        <div className="flex items-baseline justify-between border-t pt-3">
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-6 w-24" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageContent>
    );
}

/** Metrics: four stat cards, three summary cards, then a pair of detail cards. */
export function MetricsSkeleton() {
    const statCard = (key: number) => (
        <Card key={key} className="gap-3 py-4">
            <CardContent className="space-y-2.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-28" />
            </CardContent>
        </Card>
    );
    const listCard = (key: number, rows: number) => (
        <Card key={key} className="gap-0 py-0">
            <CardHeader className="border-b py-3.5">
                <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="divide-y px-4">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="flex items-center justify-between py-3">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3.5 w-12" />
                    </div>
                ))}
            </CardContent>
        </Card>
    );
    return (
        <PageContent width="wide" className="space-y-6">
            <div aria-busy="true" role="status" className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map(statCard)}</div>
                <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(i => listCard(i, 3))}</div>
                <div className="grid gap-4 md:grid-cols-2">{[0, 1].map(i => listCard(i, 4))}</div>
            </div>
        </PageContent>
    );
}

/** The coupon form with its live-preview card, shown while the parent event loads. */
export function CouponFormSkeleton() {
    return (
        <PageContent width="wide">
            <div aria-busy="true" role="status" className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-7 w-56" />
                    <Skeleton className="h-3.5 w-64" />
                </div>
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-5">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-3.5 w-28" />
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ))}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Skeleton className="h-12" />
                            <Skeleton className="h-12" />
                        </div>
                    </div>
                    <Card className="h-fit gap-0 py-0">
                        <CardHeader className="border-b py-3">
                            <Skeleton className="h-3 w-20" />
                        </CardHeader>
                        <CardContent className="space-y-3 py-4">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageContent>
    );
}

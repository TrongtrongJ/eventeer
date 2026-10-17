import { cn } from "@/lib/utils";

/** Linear-style progress ring: how full something is (0-1). Used for seat availability. */
export function ProgressRing({ value, className }: { value: number; className?: string }) {
    const clamped = Math.min(1, Math.max(0, value));
    const r = 5.5;
    const c = 2 * Math.PI * r;
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className={cn("size-4 shrink-0", className)}>
            <circle cx="8" cy="8" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.75" />
            <circle
                cx="8"
                cy="8"
                r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeDasharray={`${c * clamped} ${c}`}
                transform="rotate(-90 8 8)"
            />
        </svg>
    );
}

export type BookingStatusKind = "CONFIRMED" | "PENDING" | "CANCELLED" | "FAILED";

/** Status glyphs in the same family as Linear's issue states. */
export function BookingStatusIcon({ status, className }: { status: string; className?: string }) {
    const base = cn("size-4 shrink-0", className);
    switch (status) {
        case "CONFIRMED":
            return (
                <svg viewBox="0 0 16 16" aria-hidden="true" className={cn(base, "text-success")}>
                    <circle cx="8" cy="8" r="6.25" fill="currentColor" />
                    <path
                        d="M5.2 8.2l2 2 3.6-3.9"
                        fill="none"
                        stroke="var(--background)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            );
        case "PENDING":
            return (
                <svg viewBox="0 0 16 16" aria-hidden="true" className={cn(base, "text-warning")}>
                    <circle
                        cx="8"
                        cy="8"
                        r="6.25"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="2.2 2.2"
                    />
                    <path
                        d="M8 4.6V8l2.2 1.4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            );
        default:
            return (
                <svg viewBox="0 0 16 16" aria-hidden="true" className={cn(base, "text-muted-foreground")}>
                    <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path
                        d="M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </svg>
            );
    }
}

/** Dot + label, no pill: the quietest way to show a status in a dense row. */
export function StatusDot({
    tone,
    children,
}: {
    tone: "success" | "warning" | "danger" | "muted";
    children: React.ReactNode;
}) {
    const colors = {
        success: "bg-success",
        warning: "bg-warning",
        danger: "bg-destructive",
        muted: "bg-muted-foreground/50",
    } as const;
    return (
        <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", colors[tone])} />
            {children}
        </span>
    );
}

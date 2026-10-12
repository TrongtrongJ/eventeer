import { Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                "grid size-5 shrink-0 place-items-center rounded-[6px] bg-primary text-primary-foreground inset-shadow-xs inset-shadow-white/30",
                className,
            )}
        >
            <Ticket className="size-3 -rotate-12" strokeWidth={2.25} />
        </span>
    );
}

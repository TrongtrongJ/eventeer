import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A styled native <select>. It works with react-hook-form's `register()` and gives mobile users the
 * platform picker, which is why it is used for the short, fixed option lists in this app.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
    return (
        <div data-slot="native-select-wrapper" className="relative w-full">
            <select
                data-slot="native-select"
                className={cn(
                    "h-8 w-full appearance-none rounded-md border border-input bg-transparent py-1 pr-8 pl-2.5 text-base shadow-xs transition-[color,box-shadow,border-color] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 dark:[&>option]:bg-popover",
                    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
                    "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
                    className,
                )}
                {...props}
            >
                {children}
            </select>
            <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
        </div>
    );
}

export { NativeSelect };

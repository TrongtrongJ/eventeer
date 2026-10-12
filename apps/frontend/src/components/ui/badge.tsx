import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
    {
        variants: {
            variant: {
                default: "border-border bg-secondary text-secondary-foreground",
                primary: "border-primary/25 bg-primary/12 text-primary dark:text-[#a3acff]",
                outline: "border-border text-muted-foreground",
                success: "border-success/25 bg-success/10 text-success",
                warning: "border-warning/30 bg-warning/10 text-warning",
                destructive: "border-destructive/25 bg-destructive/10 text-destructive",
                info: "border-info/25 bg-info/10 text-info",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

function Badge({
    className,
    variant,
    asChild = false,
    ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : "span";

    return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

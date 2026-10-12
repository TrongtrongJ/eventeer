import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground inset-shadow-xs inset-shadow-white/20 hover:bg-primary/90",
                secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-accent",
                outline: "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-8 px-3 has-[>svg]:px-2.5",
                sm: "h-7 gap-1 px-2.5 text-xs has-[>svg]:px-2",
                lg: "h-9 px-4 has-[>svg]:px-3",
                icon: "size-8",
                "icon-sm": "size-7",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

function Button({
    className,
    variant,
    size,
    asChild = false,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot.Root : "button";

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };

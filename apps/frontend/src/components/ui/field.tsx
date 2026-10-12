import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/** A label + control + hint/error stack. Keeps every form in the app spaced and worded the same way. */
function Field({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="field" className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
    return <Label data-slot="field-label" className={cn("text-[13px] text-foreground/90", className)} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
    return <p data-slot="field-description" className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

function FieldError({ className, children, ...props }: React.ComponentProps<"p">) {
    if (!children) return null;
    return (
        <p data-slot="field-error" role="alert" className={cn("text-xs text-destructive", className)} {...props}>
            {children}
        </p>
    );
}

/** A bordered group of related fields with a heading, used to split long forms into sections. */
function FieldSet({
    title,
    description,
    className,
    children,
    ...props
}: Omit<React.ComponentProps<"section">, "title"> & { title: React.ReactNode; description?: React.ReactNode }) {
    return (
        <section
            data-slot="field-set"
            className={cn("grid gap-x-8 gap-y-4 py-6 md:grid-cols-[200px_1fr]", className)}
            {...props}
        >
            <div className="space-y-1">
                <h2 className="text-sm font-medium">{title}</h2>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
            <div className="flex flex-col gap-4">{children}</div>
        </section>
    );
}

export { Field, FieldLabel, FieldDescription, FieldError, FieldSet };

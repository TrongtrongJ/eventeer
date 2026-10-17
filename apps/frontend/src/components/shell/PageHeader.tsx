import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
    label: string;
    href?: string;
}

interface PageHeaderProps {
    /** The page's own title. Rendered as the page <h1> unless `titleAsText` is set. */
    title?: React.ReactNode;
    /** Ancestors shown before the title, e.g. Events / Summer Fest. */
    crumbs?: Crumb[];
    /** A small count / badge shown next to the title. */
    meta?: React.ReactNode;
    /** Render the title as plain text so the page can own its own <h1>. */
    titleAsText?: boolean;
    actions?: React.ReactNode;
}

/** Linear-style sticky top bar: breadcrumb-ish title on the left, page actions on the right. */
export function PageHeader({ title, crumbs, meta, titleAsText, actions }: PageHeaderProps) {
    const Title = titleAsText ? "span" : "h1";
    return (
        <header className="sticky top-0 z-20 flex h-11 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 print:hidden">
            <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                {crumbs?.map((crumb, index) => {
                    // Phones only have room for the nearest parent; it doubles as the "back" link.
                    const visibility = index === crumbs.length - 1 ? "" : "max-sm:hidden";
                    return (
                        <React.Fragment key={crumb.label}>
                            {crumb.href ? (
                                <Link
                                    href={crumb.href}
                                    className={cn(
                                        "min-w-0 truncate text-muted-foreground transition-colors hover:text-foreground max-sm:max-w-28 sm:max-w-48",
                                        visibility,
                                    )}
                                >
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span
                                    className={cn(
                                        "min-w-0 truncate text-muted-foreground max-sm:max-w-28 sm:max-w-48",
                                        visibility,
                                    )}
                                >
                                    {crumb.label}
                                </span>
                            )}
                            <ChevronRight
                                aria-hidden="true"
                                className={cn("size-3.5 shrink-0 text-muted-foreground/60", visibility)}
                            />
                        </React.Fragment>
                    );
                })}
                {title && <Title className="truncate font-medium">{title}</Title>}
                <span className="shrink-0">{meta}</span>
            </nav>
            {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
    );
}

const widths = {
    narrow: "max-w-2xl",
    default: "max-w-4xl",
    wide: "max-w-6xl",
    full: "max-w-none",
} as const;

/** Centered, padded page body. */
export function PageContent({
    width = "default",
    className,
    ...props
}: React.ComponentProps<"div"> & { width?: keyof typeof widths }) {
    return <div className={cn("mx-auto w-full px-4 py-6 md:px-6 md:py-8", widths[width], className)} {...props} />;
}

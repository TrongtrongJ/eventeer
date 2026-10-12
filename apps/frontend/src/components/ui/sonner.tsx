"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** shadcn's Sonner wrapper: toasts pick up the app's popover colours and follow the active theme. */
const Toaster = ({ ...props }: ToasterProps) => {
    const { theme = "light" } = useTheme();

    return (
        <Sonner
            theme={theme as ToasterProps["theme"]}
            className="toaster group"
            style={
                {
                    "--normal-bg": "var(--popover)",
                    "--normal-text": "var(--popover-foreground)",
                    "--normal-border": "var(--border)",
                    "--success-bg": "var(--popover)",
                    "--success-text": "var(--popover-foreground)",
                    "--success-border": "var(--border)",
                    "--error-bg": "var(--popover)",
                    "--error-text": "var(--popover-foreground)",
                    "--error-border": "color-mix(in oklab, var(--destructive) 45%, var(--border))",
                    "--border-radius": "var(--radius)",
                } as React.CSSProperties
            }
            {...props}
        />
    );
};

export { Toaster };

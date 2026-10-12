"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle({ side = "top" }: { side?: "top" | "bottom" | "left" | "right" }) {
    const t = useTranslations("Nav");
    const { theme = "light", setTheme } = useTheme();

    const options = [
        { value: "light", label: t("themeLight"), icon: Sun },
        { value: "dark", label: t("themeDark"), icon: Moon },
        { value: "system", label: t("themeSystem"), icon: Monitor },
    ] as const;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t("theme")} className="text-muted-foreground">
                    {/* CSS decides which icon shows, so there is no hydration mismatch with the stored theme. */}
                    <Sun className="dark:hidden" />
                    <Moon className="hidden dark:block" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side={side} align="end" className="min-w-36">
                {options.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
                        <Icon />
                        {label}
                        {theme === value && <Check className="ml-auto size-3.5 text-foreground" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

"use client";

import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages, LogIn, LogOut, Monitor, Moon, Sun, User as UserIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/actions/locale-actions";
import { locales, type Locale } from "@/i18n/helper";
import { useSession } from "@/hooks/useSession";
import { useSignOut } from "@/hooks/useSignOut";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { visibleNavItems } from "./nav-items";

interface CommandMenuProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** ⌘K / Ctrl+K palette: jump anywhere, switch theme or language, sign out. */
export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
    const t = useTranslations("Nav");
    const tLocale = useTranslations("Locale");
    const router = useRouter();
    const { setTheme } = useTheme();
    const currentLocale = useLocale();
    const { user, isAuthenticated } = useSession();
    const signOut = useSignOut();
    const [, startTransition] = useTransition();

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                onOpenChange(!open);
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [open, onOpenChange]);

    const run = useCallback(
        (action: () => void) => {
            onOpenChange(false);
            action();
        },
        [onOpenChange],
    );

    const items = visibleNavItems(user);

    return (
        <CommandDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t("search")}
            description={t("commandPlaceholder")}
        >
            <CommandInput placeholder={t("commandPlaceholder")} />
            <CommandList>
                <CommandEmpty>{t("commandEmpty")}</CommandEmpty>

                <CommandGroup heading={t("commandGoTo")}>
                    {items.map(item => {
                        const Icon = item.icon;
                        return (
                            <CommandItem
                                key={item.id}
                                value={t(item.labelKey)}
                                onSelect={() => run(() => router.push(item.href))}
                            >
                                <Icon />
                                {t(item.labelKey)}
                            </CommandItem>
                        );
                    })}
                    {isAuthenticated && (
                        <CommandItem value={t("profile")} onSelect={() => run(() => router.push("/profile"))}>
                            <UserIcon />
                            {t("profile")}
                        </CommandItem>
                    )}
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading={t("commandPreferences")}>
                    <CommandItem
                        value={`${t("theme")} ${t("themeLight")}`}
                        onSelect={() => run(() => setTheme("light"))}
                    >
                        <Sun />
                        {t("theme")}: {t("themeLight")}
                    </CommandItem>
                    <CommandItem value={`${t("theme")} ${t("themeDark")}`} onSelect={() => run(() => setTheme("dark"))}>
                        <Moon />
                        {t("theme")}: {t("themeDark")}
                    </CommandItem>
                    <CommandItem
                        value={`${t("theme")} ${t("themeSystem")}`}
                        onSelect={() => run(() => setTheme("system"))}
                    >
                        <Monitor />
                        {t("theme")}: {t("themeSystem")}
                    </CommandItem>
                    {locales
                        .filter(locale => locale !== currentLocale)
                        .map((locale: Locale) => (
                            <CommandItem
                                key={locale}
                                value={`${tLocale("label")} ${tLocale(`names.${locale}`)}`}
                                onSelect={() => run(() => startTransition(() => setLocale(locale)))}
                            >
                                <Languages />
                                {tLocale("label")}: {tLocale(`names.${locale}`)}
                            </CommandItem>
                        ))}
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading={t("commandAccount")}>
                    {isAuthenticated ? (
                        <CommandItem value={t("signOut")} onSelect={() => run(() => void signOut())}>
                            <LogOut />
                            {t("signOut")}
                        </CommandItem>
                    ) : (
                        <CommandItem value={t("signIn")} onSelect={() => run(() => router.push("/login"))}>
                            <LogIn />
                            {t("signIn")}
                        </CommandItem>
                    )}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { AccountMenu } from "./AccountMenu";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";
import { visibleNavItems, type NavGroup } from "./nav-items";

interface AppSidebarProps {
    onOpenCommand: () => void;
    /** Called after any navigation, so the mobile sheet can close itself. */
    onNavigate?: () => void;
}

export function AppSidebar({ onOpenCommand, onNavigate }: AppSidebarProps) {
    const t = useTranslations("Nav");
    const pathname = usePathname();
    const { user, isAuthenticated } = useSession();

    const items = visibleNavItems(user);
    const canCreateEvent = items.some(item => item.id === "create");

    const groups: { id: NavGroup; label?: string }[] = [
        { id: "main" },
        { id: "tickets", label: t("groupTickets") },
        { id: "organize", label: t("groupOrganize") },
        { id: "admin", label: t("groupAdmin") },
    ];

    return (
        <div className="flex h-full flex-col text-sidebar-foreground">
            <div className="flex h-11 shrink-0 items-center gap-2 px-3">
                <Link href="/" onClick={onNavigate} className="flex min-w-0 items-center gap-2 rounded-md py-1 pr-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
                    <BrandMark />
                    <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">{t("brand")}</span>
                </Link>
                {canCreateEvent && (
                    <Button asChild variant="ghost" size="icon-sm" className="ml-auto text-muted-foreground">
                        <Link href="/create" onClick={onNavigate} aria-label={t("createEvent")}>
                            <Plus />
                        </Link>
                    </Button>
                )}
            </div>

            <div className="px-2 pb-2">
                <button
                    type="button"
                    onClick={onOpenCommand}
                    className="flex h-7 w-full items-center gap-2 rounded-md border bg-card/40 px-2 text-left text-[13px] text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                    <Search className="size-3.5" />
                    <span className="flex-1 truncate">{t("search")}</span>
                    <Kbd className="hidden h-4 min-w-4 text-[10px] md:inline-flex">⌘K</Kbd>
                </button>
            </div>

            <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-2 py-1">
                {groups.map(group => {
                    const groupItems = items.filter(item => item.group === group.id);
                    if (groupItems.length === 0) return null;
                    return (
                        <div key={group.id} className="space-y-0.5">
                            {group.label && (
                                <p className="px-2 pb-1 text-xs font-medium text-muted-foreground/80">{group.label}</p>
                            )}
                            {groupItems.map(item => {
                                const active = item.isActive(pathname);
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        onClick={onNavigate}
                                        aria-current={active ? "page" : undefined}
                                        className={cn(
                                            "flex h-7 items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                                            active
                                                ? "bg-sidebar-accent text-foreground"
                                                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                                        )}
                                    >
                                        <Icon className={cn("size-4", active ? "text-foreground" : "text-muted-foreground")} />
                                        {t(item.labelKey)}
                                    </Link>
                                );
                            })}
                        </div>
                    );
                })}
            </nav>

            <div className="space-y-2 border-t border-sidebar-border p-2">
                <div className="flex items-center justify-between px-1">
                    <LocaleSwitcher />
                    <ThemeToggle />
                </div>
                {isAuthenticated && user ? (
                    <AccountMenu user={user} onNavigate={onNavigate} />
                ) : (
                    <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm" className="flex-1">
                            <Link href="/login" onClick={onNavigate}>
                                {t("signIn")}
                            </Link>
                        </Button>
                        <Button asChild size="sm" className="flex-1">
                            <Link href="/register" onClick={onNavigate}>
                                {t("signUp")}
                            </Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import Link from "next/link";
import { ChevronsUpDown, LogOut, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UserDto } from "@packages/shared-schemas";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/hooks/useSignOut";

export function AccountMenu({ user, onNavigate }: { user: UserDto; onNavigate?: () => void }) {
    const t = useTranslations("Nav");
    const signOut = useSignOut();

    const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`;
    const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={t("accountMenu")}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 data-[state=open]:bg-sidebar-accent"
            >
                <Avatar className="size-6">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={fullName} />}
                    <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{fullName}</span>
                <ChevronsUpDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
                    <span className="truncate text-sm font-medium text-foreground">{fullName}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/profile" onClick={onNavigate}>
                        <UserIcon />
                        {t("profile")}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onSelect={() => {
                        onNavigate?.();
                        void signOut();
                    }}
                >
                    <LogOut />
                    {t("signOut")}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

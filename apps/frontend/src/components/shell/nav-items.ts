import { Activity, CalendarCheck, CalendarDays, SquarePlus, Ticket, type LucideIcon } from "lucide-react";
import type { UserDto } from "@packages/shared-schemas";

type Role = UserDto["role"];

export type NavGroup = "main" | "tickets" | "organize" | "admin";

export interface NavItem {
    id: string;
    href: string;
    /** Key in the `Nav` message namespace. */
    labelKey: "events" | "myBookings" | "myEvents" | "createEvent" | "metrics";
    icon: LucideIcon;
    group: NavGroup;
    /** Needs a signed-in user. */
    auth?: boolean;
    /** Only these roles see it. */
    roles?: Role[];
    isActive: (pathname: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
    {
        id: "events",
        href: "/",
        labelKey: "events",
        icon: CalendarDays,
        group: "main",
        isActive: p => p === "/" || /^\/events\/[^/]+$/.test(p),
    },
    {
        id: "bookings",
        href: "/bookings",
        labelKey: "myBookings",
        icon: Ticket,
        group: "tickets",
        auth: true,
        isActive: p => p.startsWith("/bookings") || p.startsWith("/booking/") || p.startsWith("/checkout"),
    },
    {
        id: "my-events",
        href: "/my-events",
        labelKey: "myEvents",
        icon: CalendarCheck,
        group: "organize",
        auth: true,
        roles: ["ORGANIZER", "ADMIN"],
        isActive: p => p.startsWith("/my-events") || /^\/events\/[^/]+\/coupons/.test(p),
    },
    {
        id: "create",
        href: "/create",
        labelKey: "createEvent",
        icon: SquarePlus,
        group: "organize",
        auth: true,
        roles: ["ORGANIZER", "ADMIN"],
        isActive: p => p === "/create",
    },
    {
        id: "metrics",
        href: "/metrics",
        labelKey: "metrics",
        icon: Activity,
        group: "admin",
        auth: true,
        roles: ["ADMIN"],
        isActive: p => p.startsWith("/metrics"),
    },
];

export function visibleNavItems(user: UserDto | null): NavItem[] {
    return NAV_ITEMS.filter(item => {
        if (item.auth && !user) return false;
        if (item.roles && (!user || !item.roles.includes(user.role))) return false;
        return true;
    });
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { AppSidebar } from "./AppSidebar";
import { BrandMark } from "./BrandMark";
import { CommandMenu } from "./CommandMenu";

/** Auth screens are full-bleed and centred: no sidebar, no app chrome. */
const BARE_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

export function AppShell({ children }: { children: React.ReactNode }) {
    const t = useTranslations("Nav");
    const pathname = usePathname();
    const mainRef = useRef<HTMLElement>(null);
    const [commandOpen, setCommandOpen] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    // The page scrolls inside <main>, so Next's own scroll-to-top on navigation does not reach it.
    useEffect(() => {
        mainRef.current?.scrollTo({ top: 0 });
    }, [pathname]);

    const isBare = BARE_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
    if (isBare) return <>{children}</>;

    return (
        <div className="flex h-dvh overflow-hidden bg-sidebar print:block print:h-auto print:overflow-visible print:bg-white">
            <aside className="hidden w-60 shrink-0 lg:block print:hidden">
                <AppSidebar onOpenCommand={() => setCommandOpen(true)} />
            </aside>

            <div className="flex min-w-0 flex-1 flex-col lg:py-2 lg:pr-2 print:p-0">
                <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-sidebar px-2 lg:hidden print:hidden">
                    <Button variant="ghost" size="icon" className="size-9" aria-label={t("openMenu")} onClick={() => setMobileNavOpen(true)}>
                        <Menu />
                    </Button>
                    <BrandMark />
                    <span className="text-[13px] font-semibold tracking-tight">{t("brand")}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("search")}
                        className="ml-auto size-9 text-muted-foreground"
                        onClick={() => setCommandOpen(true)}
                    >
                        <Search />
                    </Button>
                </div>

                <main
                    ref={mainRef}
                    className="scrollbar-thin relative flex-1 overflow-y-auto bg-background lg:rounded-xl lg:border lg:shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none"
                >
                    {children}
                </main>
            </div>

            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetContent side="left" className="gap-0 p-0">
                    <SheetTitle className="sr-only">{t("navigation")}</SheetTitle>
                    <SheetDescription className="sr-only">{t("navigation")}</SheetDescription>
                    <AppSidebar
                        onNavigate={() => setMobileNavOpen(false)}
                        onOpenCommand={() => {
                            setMobileNavOpen(false);
                            setCommandOpen(true);
                        }}
                    />
                </SheetContent>
            </Sheet>

            <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
        </div>
    );
}

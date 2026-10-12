"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";

/** Centred single-column frame used by sign in, sign up and the password / verification screens. */
export function AuthLayout({ title, description, children }: { title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode }) {
    const t = useTranslations("Nav");

    return (
        <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
            <div className="absolute top-3 right-3 flex items-center gap-2">
                <LocaleSwitcher />
                <ThemeToggle side="bottom" />
            </div>

            <div className="w-full max-w-sm space-y-8">
                <div className="flex flex-col items-center gap-5 text-center">
                    <Link href="/" aria-label={t("brand")} className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
                        <BrandMark className="size-9 rounded-xl [&_svg]:size-5" />
                    </Link>
                    <div className="space-y-1.5">
                        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                        {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}

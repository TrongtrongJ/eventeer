import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Thai } from "next/font/google";
import React, { Suspense } from "react";
import { Providers } from "./providers";
import { AppShell } from "@/components/shell/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getSessionSeed } from "@/lib/auth/session";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ZodLocale } from "@/components/ZodLocale";
import { cn } from "@/lib/utils";
import "./globals.css";

// Inter has no Thai glyphs, so Noto Sans Thai is the fallback in the --font-sans stack (see globals.css).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const notoSansThai = Noto_Sans_Thai({ subsets: ["thai"], variable: "--font-thai", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("Metadata");
    return { title: t("title"), description: t("description") };
}

async function DynamicAppShell({ children }: { children: React.ReactNode }) {
    const [sessionSeed] = await Promise.all([getSessionSeed(), getLocale()]);

    return (
        <Providers sessionSeed={sessionSeed}>
            <NextIntlClientProvider>
                <ZodLocale />
                <AppShell>{children}</AppShell>
            </NextIntlClientProvider>
        </Providers>
    );
}

/** What streams first, before the session is known: the empty frame of the app. */
function ShellFallback() {
    return (
        <div className="flex h-dvh bg-sidebar" aria-hidden="true">
            <div className="hidden w-60 shrink-0 lg:block" />
            <div className="flex-1 bg-background lg:my-2 lg:mr-2 lg:rounded-xl lg:border" />
        </div>
    );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={cn(inter.variable, notoSansThai.variable, jetbrainsMono.variable)}
        >
            <body className="min-h-dvh font-sans">
                <ThemeProvider>
                    {/* The session and locale are dynamic, so the shell is wrapped in Suspense (cacheComponents). */}
                    <Suspense fallback={<ShellFallback />}>
                        <DynamicAppShell>{children}</DynamicAppShell>
                    </Suspense>
                </ThemeProvider>
            </body>
        </html>
    );
}

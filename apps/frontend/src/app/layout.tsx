import type { Metadata } from "next";
import React, { Suspense } from "react";
import { Providers } from "./providers";
import Navigation from "@/components/Navigation";
import { getSessionSeed } from "@/lib/auth/session";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ZodLocale } from "@/components/ZodLocale";
import "./globals.css";

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
                <Navigation />
                <main>{children}</main>
            </NextIntlClientProvider>
        </Providers>
    );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className="min-h-screen bg-gray-50">
                {/* 3. Wrap the dynamic shell in Suspense */}
                <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
                    <DynamicAppShell>{children}</DynamicAppShell>
                </Suspense>
            </body>
        </html>
    );
}

import type { Metadata } from "next";
import React from "react";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const [sessionSeed, locale] = await Promise.all([getSessionSeed(), getLocale()]);

    return (
        <html lang={locale}>
            <body className="min-h-screen bg-gray-50">
                <Providers sessionSeed={sessionSeed}>
                    <NextIntlClientProvider>
                        <ZodLocale />
                        <Navigation />
                        <main>{children}</main>
                    </NextIntlClientProvider>
                </Providers>
            </body>
        </html>
    );
}

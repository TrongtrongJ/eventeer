import type { Metadata } from 'next';
import React from 'react';
import { Providers } from './providers';
import Navigation from '@/components/Navigation';
import { getSessionSeed } from '@/lib/auth/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Event Manager',
  description: 'Discover, book, and manage events',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sessionSeed = await getSessionSeed();

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Providers sessionSeed={sessionSeed}>
          <Navigation />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}

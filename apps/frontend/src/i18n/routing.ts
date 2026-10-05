import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'th'] as const;

export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  
  // Strategy for locale prefixes in the URL 
  // 'always' (e.g., /en/about) or 'as-needed' (e.g., /about for default, /th/about for others)
  localePrefix: 'as-needed',
});

// 2. Export the localized navigation APIs
// These are lightweight wrappers around Next.js' native navigation APIs 
// that automatically handle the locale prefixing and routing config under the hood.
export const { 
  Link, 
  redirect, 
  usePathname, 
  useRouter, 
  getPathname 
} = createNavigation(routing);
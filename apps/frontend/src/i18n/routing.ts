import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

// 1. Define the routing configuration
export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'th'],
  
  // Used when no locale matches
  defaultLocale: 'en',
  
  // Strategy for locale prefixes in the URL 
  // 'always' (e.g., /en/about) or 'as-needed' (e.g., /about for default, /th/about for others)
  localePrefix: 'as-needed',

  // Optional: Route-based localized pathnames
  pathnames: {
    '/': '/',
    
    // Example of localized routes based on the locale
    '/about': {
      en: '/about',
      th: '/เกี่ยวกับเรา'
    },
    
    // You can add parameters as well
    '/users/[id]': {
      en: '/users/[id]',
      th: '/ผู้ใช้งาน/[id]'
    }
  }
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
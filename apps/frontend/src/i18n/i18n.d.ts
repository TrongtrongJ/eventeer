import type en from "../../messages/en.json";
import type { Locale } from "./helper";

// Makes `t('Some.key')` a compile-time-checked key, and `useLocale()` return `'en' | 'th'`.
declare module "next-intl" {
    interface AppConfig {
        Locale: Locale;
        Messages: typeof en;
    }
}

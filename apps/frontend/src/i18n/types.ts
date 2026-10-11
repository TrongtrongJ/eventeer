import type { useFormatter } from "next-intl";

/** The object returned by `useFormatter()` / `await getFormatter()`, for helpers that format dates. */
export type Formatter = ReturnType<typeof useFormatter>;

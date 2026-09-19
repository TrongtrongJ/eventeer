export const AUTH_COOKIE = {
    ACCESS: "access_token",
    REFRESH: "refresh_token",
} as const;

interface SharedCookieOptions {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    priority?: "low" | "medium" | "high";
    sameSite?: true | false | "lax" | "strict" | "none";
    secure?: boolean;
}

const secureCookieOptions: SharedCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
};

export function getCookieOptions(override?: Partial<SharedCookieOptions>) {
    return {
        ...secureCookieOptions,
        ...override,
    };
}

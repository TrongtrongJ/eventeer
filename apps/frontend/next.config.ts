import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import bundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
    // Enable react compiler to ease with hooks optimization
    reactCompiler: true,

    reactStrictMode: true,

    transpilePackages: ["@packages/shared-schemas"],

    experimental: {
        optimizePackageImports: ["@packages/shared-schemas", "@mui/icons-material", "recharts"],
        externalDir: true,
        turbopackFileSystemCacheForDev: true,
    },

    // Security headers applied to all routes
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "X-XSS-Protection", value: "1; mode=block" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=()",
                    },
                ],
            },
        ];
    },
};

export default withBundleAnalyzer(withNextIntl(nextConfig));

import createNextIntlPlugin from "next-intl/plugin";
import bundleAnalyzer from "@next/bundle-analyzer";
import path from "node:path";
import type { NextConfig } from "next";

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
});

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
    cacheComponents: true,
    partialPrefetching: true,
    output: "standalone",
    // Next always transpiles next.config.ts to CommonJS, where `__dirname` is already
    // injected by the module wrapper. Do NOT redeclare it (or use import.meta.*): that makes
    // Node re-evaluate the file as ESM -> "exports is not defined in ES module scope".
    outputFileTracingRoot: path.join(__dirname, "../../"),

    reactCompiler: true,
    reactStrictMode: true,
    crossOrigin: "anonymous",

    transpilePackages: [
        "@orpc/client",
        "@orpc/tanstack-query",
        "@orpc/openapi",
        "@orpc/contract",
        "@orpc/server",
        "@packages/shared-schemas",
        "@packages/contract",
    ],
    experimental: {
        agentUpgrade: "security",
        optimizePackageImports: ["@packages/shared-schemas"],
        externalDir: true,
        turbopackGc: true,
        turbopackFileSystemCacheForDev: true,
        turbopackPluginRuntimeStrategy: "workerThreads",
        turbopackRustReactCompiler: true,
    },

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

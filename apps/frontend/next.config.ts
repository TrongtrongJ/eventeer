import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import bundleAnalyzer from "@next/bundle-analyzer";
import path from "node:path";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

//const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Self-contained server for Docker/k8s. The tracing root is the monorepo root so the
  // workspace packages (@packages/*) are included in the standalone output.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),

  // Enable react compiler to ease with hooks optimization
  reactCompiler: true,

  reactStrictMode: true,

  crossOrigin: 'anonymous',

  transpilePackages: [
    '@orpc/client', 
    '@orpc/tanstack-query', 
    '@orpc/openapi',
    "@orpc/contract",
    "@orpc/server",
    "@packages/shared-schemas", 
    "@packages/contract",
  ],

  experimental: {
    optimizePackageImports: ["@packages/shared-schemas"],
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

//export default withBundleAnalyzer(withNextIntl(nextConfig));
export default withBundleAnalyzer(nextConfig);
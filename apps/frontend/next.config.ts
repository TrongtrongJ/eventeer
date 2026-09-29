import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

console.log('Config read')
const nextConfig: NextConfig = {
  // Enable react compiler to ease with hooks optimization
  reactCompiler: true,

  reactStrictMode: true,

  transpilePackages: [
    '@orpc/client', 
    '@orpc/tanstack-query', 
    '@orpc/openapi',
    "@orpc/contract",
    "@orpc/server",
    "@orpc/react-query",
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

export default withBundleAnalyzer(nextConfig);

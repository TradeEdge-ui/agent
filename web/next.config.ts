import type { NextConfig } from "next";

// Security headers applied to every route. A strict CSP is not set here because
// Stripe Checkout and Supabase Storage are reached via redirects/fetch only, and
// the site embeds no third-party scripts; tighten further if you add analytics.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Cache Components is disabled on purpose: almost every app route is
  // per-user (dashboard/admin) and the classic dynamic-by-default model is
  // simpler to reason about for a solo-maintained codebase. Marketing pages
  // use ISR via `export const revalidate`.
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

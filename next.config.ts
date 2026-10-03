import type { NextConfig } from "next";

/**
 * Legacy Shopify URLs are redirected permanently so existing links, Google
 * results, and bookmarks keep working after the domain moves off Shopify.
 * Product URLs (/products/<handle>) are kept identical, so they need no redirect.
 */
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/collections/all", destination: "/shop", permanent: true },
      { source: "/collections/:path*", destination: "/shop", permanent: true },
      { source: "/pages/contact", destination: "/contact", permanent: true },
      { source: "/pages/:path*", destination: "/", permanent: true },
      { source: "/account/login", destination: "/account", permanent: true },
      { source: "/account/addresses", destination: "/account", permanent: true },
      { source: "/customer_authentication/:path*", destination: "/account", permanent: true },
      { source: "/policies/privacy-policy", destination: "/policies/privacy", permanent: true },
      { source: "/policies/refund-policy", destination: "/policies/refunds", permanent: true },
      { source: "/policies/terms-of-service", destination: "/policies/terms", permanent: true },
      { source: "/policies/shipping-policy", destination: "/policies/delivery", permanent: true },
      { source: "/cart/:path+", destination: "/cart", permanent: false },
    ];
  },
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      { source: "/:path*", headers: base },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;

// Enables Cloudflare bindings (env vars, secrets) during `next dev`.
// Safe to leave in place when deploying to other Node hosts.
if (process.env.NODE_ENV === "development" && process.env.CF_DEV_BINDINGS === "1") {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev()).catch(() => {});
}

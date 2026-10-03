import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.SITE_URL || "https://experiencecoffee.co";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/account", "/cart", "/checkout"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}

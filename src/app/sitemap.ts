import type { MetadataRoute } from "next";
import { listStoreProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.SITE_URL || "https://experiencecoffee.co";
  const products = await listStoreProducts().catch(() => []);
  return [
    { url: `${site}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/shop`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${site}/contact`, changeFrequency: "yearly", priority: 0.3 },
    ...["delivery", "refunds", "privacy", "terms"].map((p) => ({ url: `${site}/policies/${p}`, priority: 0.2 })),
    ...products.map((p) => ({ url: `${site}/products/${p.handle}`, lastModified: p.updatedAt, priority: 0.8 })),
  ];
}

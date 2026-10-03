import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { ProductGallery } from "@/components/ProductGallery";
import { FlavorScale, TastingCard } from "@/components/brand/TastingCard";
import { getStoreProduct } from "@/lib/catalog";
import { priceRange, splitNotes } from "@/lib/catalog-utils";
import { siteUrl } from "@/lib/env";
import { isInterval, resolveSubscriptionDiscount } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

type Params = { params: Promise<{ handle: string }>; searchParams: Promise<{ subscribe?: string }> };

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const p = await getStoreProduct(handle);
  if (!p) return { title: "Not found" };
  return {
    title: p.title,
    description: stripHtml(p.descriptionHtml).slice(0, 160),
    openGraph: { images: p.images.slice(0, 1) },
    alternates: { canonical: `/products/${p.handle}` },
  };
}

export default async function ProductPage({ params, searchParams }: Params) {
  const { handle } = await params;
  const { subscribe } = await searchParams;
  const [p, settings] = await Promise.all([getStoreProduct(handle), getSettings()]);
  if (!p) notFound();
  const notes = splitNotes(p.flavorNotes);
  const range = priceRange(p.variants);
  const sizes = [...new Set(p.variants.map((v) => v.size).filter(Boolean))].join(" / ");
  const anyInStock = p.variants.some((v) => !v.trackInventory || v.inventory > 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    image: p.images.map((i) => (i.startsWith("http") ? i : `${siteUrl()}${i}`)),
    description: stripHtml(p.descriptionHtml),
    brand: { "@type": "Brand", name: "Experience Coffee" },
    offers: range
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: (range.min / 100).toFixed(2),
          highPrice: (range.max / 100).toFixed(2),
          availability: anyInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          url: `${siteUrl()}/products/${p.handle}`,
        }
      : undefined,
  };

  return (
    <div className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="product">
        <ProductGallery images={p.images} title={p.title} />
        <div>
          <p className="eyebrow">{p.kind === "cold_brew" ? "Cold brew" : p.origin ? `Single origin · ${p.origin}` : "Coffee"}</p>
          <h1 className="product-title">{p.title}</h1>
          {notes.length ? (
            <p className="product-notes">{notes.map((n) => n.charAt(0).toUpperCase() + n.slice(1)).join(". ")}.</p>
          ) : null}
          <TastingCard
            notes={p.flavorNotes}
            origin={p.origin}
            process={p.process}
            footer={sizes ? `Whole bean or ground · ${sizes}` : null}
            score={p.cuppingScore}
          />
          <FlavorScale process={p.process} title={p.title} />
          <AddToCart
            product={{ id: p.id, title: p.title, handle: p.handle, image: p.images[0], subscriptionEnabled: p.subscriptionEnabled }}
            variants={p.variants.map((v) => ({
              id: v.id,
              title: v.title,
              size: v.size,
              grind: v.grind,
              priceCents: v.priceCents,
              trackInventory: v.trackInventory,
              inventory: v.inventory,
              active: v.active,
            }))}
            discount={resolveSubscriptionDiscount(p, settings.subscriptionDiscountPercent)}
            intervals={settings.subscriptionIntervals}
            defaultPurchase={subscribe ? "sub" : "once"}
            defaultInterval={isInterval(subscribe) ? subscribe : undefined}
          />
          <div className="notice">
            {settings.pickupEnabled ? <>Free pickup in Lyndhurst. </> : null}
            {settings.deliveryEnabled ? <>Free local delivery to nearby towns. </> : null}
            {settings.shippingEnabled ? <>Shipping anywhere in the US.</> : null}
          </div>
          <div className="prose" dangerouslySetInnerHTML={{ __html: p.descriptionHtml }} />
        </div>
      </div>
    </div>
  );
}

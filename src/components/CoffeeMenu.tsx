import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog";
import { priceRange } from "@/lib/catalog-utils";
import { formatCents } from "@/lib/money";

export function CoffeeMenu({ products }: { products: CatalogProduct[] }) {
  return (
    <div className="menu">
      {products.map((p) => {
        const range = priceRange(p.variants);
        const meta = [p.origin, p.process ? `${p.process.toLowerCase()} process` : null, p.cuppingScore ? `${p.cuppingScore} points` : null]
          .filter(Boolean)
          .join(", ");
        return (
          <Link key={p.id} href={`/products/${p.handle}`} className="menu-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.images[0] ? <img className="menu-thumb" src={p.images[0]} alt="" loading="lazy" /> : <span className="menu-thumb" />}
            <div>
              <p className="menu-name">{p.title}</p>
              {meta ? <p className="menu-meta">{meta}</p> : null}
            </div>
            <p className="menu-notes">{p.flavorNotes || (p.kind === "cold_brew" ? "Ready to pour, straight from your fridge" : "")}</p>
            <div className="menu-price">
              {range ? (range.min === range.max ? formatCents(range.min) : `From ${formatCents(range.min)}`) : ""}
              {p.variants.some((v) => v.size) ? <small>{[...new Set(p.variants.map((v) => v.size).filter(Boolean))].join(" / ")}</small> : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

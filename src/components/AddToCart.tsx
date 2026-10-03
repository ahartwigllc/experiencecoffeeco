"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { inStock, uniqueValues, variantLabel, type VariantLike } from "@/lib/catalog-utils";
import { formatCents } from "@/lib/money";
import { INTERVALS, applySubscriptionDiscount, subscriptionDiscountLabel, type Interval, type SubscriptionDiscount } from "@/lib/pricing";
import { useCart } from "./CartProvider";

type Props = {
  product: { id: number; title: string; handle: string; image?: string; subscriptionEnabled: boolean };
  variants: VariantLike[];
  discount: SubscriptionDiscount;
  intervals: Interval[];
  defaultPurchase?: "once" | "sub";
  defaultInterval?: Interval;
};

export function AddToCart({ product, variants, discount, intervals, defaultPurchase = "once", defaultInterval }: Props) {
  const cart = useCart();
  const sizes = uniqueValues(variants.map((v) => v.size));
  const grinds = uniqueValues(variants.map((v) => v.grind));
  const firstAvailable = variants.find((v) => inStock(v)) ?? variants[0];

  const [size, setSize] = useState<string | null>(firstAvailable?.size ?? null);
  const [grind, setGrind] = useState<string | null>(firstAvailable?.grind ?? null);
  const canSubscribe = product.subscriptionEnabled && intervals.length > 0;
  const [purchase, setPurchase] = useState<"once" | "sub">(canSubscribe ? defaultPurchase : "once");
  const [interval, setInterval] = useState<Interval>(
    defaultInterval && intervals.includes(defaultInterval) ? defaultInterval : intervals.includes("2week") ? "2week" : intervals[0] ?? "month",
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = useMemo(() => {
    if (!sizes.length && !grinds.length) return variants[0];
    return variants.find((v) => (sizes.length ? v.size === size : true) && (grinds.length ? v.grind === grind : true));
  }, [variants, sizes.length, grinds.length, size, grind]);

  const available = variant ? inStock(variant, qty) : false;
  const onePrice = variant?.priceCents ?? 0;
  const subPrice = applySubscriptionDiscount(onePrice, discount);
  const saveLabel = subscriptionDiscountLabel(discount);

  function grindAvailable(g: string) {
    return variants.some((v) => v.grind === g && (sizes.length ? v.size === size : true) && inStock(v));
  }
  function sizeAvailable(s: string) {
    return variants.some((v) => v.size === s && inStock(v));
  }

  function onAdd() {
    if (!variant || !available) return;
    cart.add({
      variantId: variant.id,
      quantity: qty,
      interval: purchase === "sub" ? interval : null,
      productTitle: product.title,
      variantTitle: variantLabel(variant),
      handle: product.handle,
      image: product.image,
      unitPriceCents: purchase === "sub" ? subPrice : onePrice,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 4000);
  }

  return (
    <div>
      {sizes.length > 1 && (
        <fieldset className="option-group">
          <legend>Size</legend>
          <div className="chips">
            {sizes.map((s) => (
              <label className="chip" key={s}>
                <input type="radio" name="size" value={s} checked={size === s} disabled={!sizeAvailable(s)} onChange={() => setSize(s)} />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {grinds.length > 1 && (
        <fieldset className="option-group">
          <legend>Grind</legend>
          <div className="chips">
            {grinds.map((g) => (
              <label className="chip" key={g}>
                <input type="radio" name="grind" value={g} checked={grind === g} disabled={!grindAvailable(g)} onChange={() => setGrind(g)} />
                <span>{g}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="purchase-options" role="radiogroup" aria-label="How often">
        <label className="purchase-option">
          <input type="radio" name="purchase" checked={purchase === "once"} onChange={() => setPurchase("once")} />
          <strong>One time</strong>
          <span>{formatCents(onePrice)}</span>
        </label>
        {canSubscribe && (
          <label className="purchase-option">
            <input type="radio" name="purchase" checked={purchase === "sub"} onChange={() => setPurchase("sub")} />
            <span>
              <strong>Subscribe</strong> {saveLabel ? <span className="save-tag">{saveLabel}</span> : null}
              <br />
              <span className="stock-note">Skip, pause, or cancel any time.</span>
            </span>
            <span>{formatCents(subPrice)}</span>
          </label>
        )}
      </div>

      {purchase === "sub" && canSubscribe && (
        <div className="field">
          <label htmlFor="interval">Deliver</label>
          <select id="interval" value={interval} onChange={(e) => setInterval(e.target.value as Interval)}>
            {intervals.map((i) => (
              <option key={i} value={i}>
                {INTERVALS[i].label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="buy-row">
        <div className="qty">
          <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>
            −
          </button>
          <input
            aria-label="Quantity"
            type="number"
            min={1}
            max={50}
            value={qty}
            onChange={(e) => setQty(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
          />
          <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(50, q + 1))}>
            +
          </button>
        </div>
        <button type="button" className="btn btn-cherry" onClick={onAdd} disabled={!variant || !available}>
          {!variant ? "Choose options" : available ? "Add to cart" : "Sold out"}
        </button>
      </div>
      {variant && variant.trackInventory && variant.inventory > 0 && variant.inventory <= 5 && (
        <p className="stock-note">Only {variant.inventory} left in this option.</p>
      )}
      <p role="status" aria-live="polite" className="added-note">
        {added ? (
          <>
            Added. <Link href="/cart">View cart</Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
